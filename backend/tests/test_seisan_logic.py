"""清算計算ロジックの単体テスト（pairwise netting）"""

from app.features.costs.seisan_calculator import (
    CostEntry,
    build_pairwise_debts,
    calculate_pairwise_settlements,
)


def _net_balance(transfers: list[tuple[int, int, int]]) -> dict[int, int]:
    """送金リストを適用したときの純収支を返す（ゼロならすべて清算済み）"""
    result: dict[int, int] = {}
    for from_uid, to_uid, amount in transfers:
        result[from_uid] = result.get(from_uid, 0) - amount
        result[to_uid] = result.get(to_uid, 0) + amount
    return result


# ─── build_pairwise_debts テスト ─────────────────────────────────────────────


def test_pairwise_equal_split_two_members():
    """2人均等割り: user2 が user1 に半額を返す"""
    costs = [CostEntry(payer_user_id=1, total_amount=2000, seikyusaki=[])]
    debts = build_pairwise_debts(costs, member_ids=[1, 2])
    assert debts.get((2, 1), 0) == 1000
    assert debts.get((1, 2), 0) == 0


def test_pairwise_equal_split_three_members():
    """3人均等割り: 他2人それぞれが支払者に1000返す"""
    costs = [CostEntry(payer_user_id=1, total_amount=3000, seikyusaki=[])]
    debts = build_pairwise_debts(costs, member_ids=[1, 2, 3])
    assert debts.get((2, 1), 0) == 1000
    assert debts.get((3, 1), 0) == 1000
    assert debts.get((1, 2), 0) == 0
    assert debts.get((1, 3), 0) == 0


def test_pairwise_seikyusaki_split():
    """請求先指定: 指定金額がそのまま債務として記録される"""
    costs = [
        CostEntry(
            payer_user_id=1,
            total_amount=3000,
            seikyusaki=[(2, 2000), (3, 800), (1, 200)],
        )
    ]
    debts = build_pairwise_debts(costs, member_ids=[1, 2, 3])
    assert debts.get((2, 1), 0) == 2000
    assert debts.get((3, 1), 0) == 800
    # 自分自身への請求（1→1）はスキップ
    assert debts.get((1, 1), 0) == 0


def test_pairwise_multiple_costs_three_members():
    """複数支出・3人: 各ペアの粗債務が積み上がる"""
    costs = [
        CostEntry(payer_user_id=1, total_amount=3000, seikyusaki=[]),
        CostEntry(payer_user_id=2, total_amount=1500, seikyusaki=[]),
    ]
    debts = build_pairwise_debts(costs, member_ids=[1, 2, 3])
    # cost1: 2→1: 1000, 3→1: 1000
    # cost2: 1→2: 500, 3→2: 500
    assert debts.get((2, 1), 0) == 1000
    assert debts.get((3, 1), 0) == 1000
    assert debts.get((1, 2), 0) == 500
    assert debts.get((3, 2), 0) == 500


def test_pairwise_remainder_absorbed_by_payer():
    """割り切れない端数は支払者が吸収: 他メンバーは切り捨てた share のみ負担"""
    costs = [CostEntry(payer_user_id=1, total_amount=1000, seikyusaki=[])]
    debts = build_pairwise_debts(costs, member_ids=[1, 2, 3])
    # 1000 // 3 = 333 (端数1は payer 吸収)
    assert debts.get((2, 1), 0) == 333
    assert debts.get((3, 1), 0) == 333


def test_pairwise_no_costs():
    """支出がない場合は債務なし"""
    debts = build_pairwise_debts([], member_ids=[1, 2, 3])
    assert dict(debts) == {}


def test_pairwise_payer_not_in_members():
    """メンバー外の支払者は無視される"""
    costs = [CostEntry(payer_user_id=99, total_amount=1000, seikyusaki=[])]
    debts = build_pairwise_debts(costs, member_ids=[1, 2])
    assert dict(debts) == {}


# ─── calculate_pairwise_settlements テスト ────────────────────────────────────


def test_settlement_simple_netting_two_members():
    """一方向の債務: そのまま 1 件の送金"""
    debts = {(2, 1): 1000}
    transfers = calculate_pairwise_settlements(debts)
    assert len(transfers) == 1
    assert transfers[0] == (2, 1, 1000)


def test_settlement_mutual_netting():
    """相互に債務がある場合は差額のみ送金"""
    # 2→1: 3000, 1→2: 1000 → 差額 2000 を 2→1
    debts = {(2, 1): 3000, (1, 2): 1000}
    transfers = calculate_pairwise_settlements(debts)
    assert len(transfers) == 1
    assert transfers[0] == (2, 1, 2000)


def test_settlement_equal_mutual_debt_no_transfer():
    """相互債務が同額: 送金なし"""
    debts = {(1, 2): 500, (2, 1): 500}
    transfers = calculate_pairwise_settlements(debts)
    assert transfers == []


def test_settlement_three_members_pairwise():
    """3人: ペアごとに独立して相殺"""
    debts = {(2, 1): 1000, (3, 1): 1000, (1, 2): 500, (3, 2): 500}
    transfers = calculate_pairwise_settlements(debts)
    # (2,1) net: 2 owes 1 1000, 1 owes 2 500 → 2→1: 500
    # (3,1) net: 3 owes 1 1000 → 3→1: 1000
    # (3,2) net: 3 owes 2 500 → 3→2: 500
    transfer_map = {(f, t): a for f, t, a in transfers}
    assert transfer_map.get((2, 1)) == 500
    assert transfer_map.get((3, 1)) == 1000
    assert transfer_map.get((3, 2)) == 500


def test_settlement_zero_debt_excluded():
    """ゼロ債務のペアは送金に含まれない"""
    debts = {(2, 1): 1000, (3, 1): 0}
    transfers = calculate_pairwise_settlements(debts)
    assert all(t[2] > 0 for t in transfers)


def test_settlement_all_equal_no_transfer():
    """全員が同額支払い → 各ペアの差額ゼロ → 送金なし"""
    costs = [
        CostEntry(payer_user_id=1, total_amount=1000, seikyusaki=[]),
        CostEntry(payer_user_id=2, total_amount=1000, seikyusaki=[]),
        CostEntry(payer_user_id=3, total_amount=1000, seikyusaki=[]),
    ]
    debts = build_pairwise_debts(costs, member_ids=[1, 2, 3])
    transfers = calculate_pairwise_settlements(debts)
    assert transfers == []


def test_settlement_real_case():
    """実データ相当の3人ケース: ユーザー期待値と一致する"""
    # Cost 9: テストユーザー②(4) pays 500, seikyusaki: ①=166, 管理者=166, ②=168
    # Cost 10: テストユーザー①(2) pays 10000, seikyusaki: ①=3333, 管理者=3333, ②=3334
    # Cost 11: 管理者(1) pays 5000, seikyusaki: 管理者=1666, ②=1666, ①=1668
    costs = [
        CostEntry(payer_user_id=4, total_amount=500, seikyusaki=[(2, 166), (1, 166), (4, 168)]),
        CostEntry(payer_user_id=2, total_amount=10000, seikyusaki=[(2, 3333), (1, 3333), (4, 3334)]),
        CostEntry(payer_user_id=1, total_amount=5000, seikyusaki=[(1, 1666), (4, 1666), (2, 1668)]),
    ]
    debts = build_pairwise_debts(costs, member_ids=[1, 2, 4])
    transfers = calculate_pairwise_settlements(debts)

    transfer_map = {(f, t): a for f, t, a in transfers}
    assert transfer_map.get((4, 1)) == 1500   # テストユーザー② → 管理者
    assert transfer_map.get((4, 2)) == 3168   # テストユーザー② → テストユーザー①
    assert transfer_map.get((1, 2)) == 1665   # 管理者 → テストユーザー①
