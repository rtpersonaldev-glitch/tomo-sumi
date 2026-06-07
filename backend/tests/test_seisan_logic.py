"""清算計算ロジックの単体テスト"""

from app.features.costs.seisan_calculator import CostEntry, build_balances, calculate_settlements


def _check_balanced(transfers: list[tuple[int, int, int]], initial: dict[int, int]) -> bool:
    """全転送が適用されるとすべての残高がゼロになることを検証する"""
    check = dict(initial)
    for from_uid, to_uid, amount in transfers:
        check[from_uid] += amount
        check[to_uid] -= amount
    return all(v == 0 for v in check.values())


# ─── build_balances テスト ────────────────────────────────────────────────────


def test_balance_equal_split_two_members():
    """2人で均等割り: 支払者に2000ではなく差分1000が残る"""
    costs = [CostEntry(payer_user_id=1, total_amount=2000, seikyusaki=[])]
    balances = build_balances(costs, member_ids=[1, 2])
    assert balances[1] == 1000
    assert balances[2] == -1000


def test_balance_equal_split_three_members():
    """3人で均等割り"""
    costs = [CostEntry(payer_user_id=1, total_amount=3000, seikyusaki=[])]
    balances = build_balances(costs, member_ids=[1, 2, 3])
    assert balances[1] == 2000
    assert balances[2] == -1000
    assert balances[3] == -1000
    assert sum(balances.values()) == 0


def test_balance_seikyusaki_split():
    """請求先指定の割り当て"""
    costs = [
        CostEntry(
            payer_user_id=1,
            total_amount=3000,
            seikyusaki=[(2, 2000), (3, 800), (1, 200)],
        )
    ]
    balances = build_balances(costs, member_ids=[1, 2, 3])
    assert balances[1] == 2800
    assert balances[2] == -2000
    assert balances[3] == -800
    assert sum(balances.values()) == 0


def test_balance_multiple_costs_three_members():
    """複数支出・3人"""
    costs = [
        CostEntry(payer_user_id=1, total_amount=3000, seikyusaki=[]),
        CostEntry(payer_user_id=2, total_amount=1500, seikyusaki=[]),
    ]
    balances = build_balances(costs, member_ids=[1, 2, 3])
    assert balances[1] == 1500
    assert balances[2] == 0
    assert balances[3] == -1500
    assert sum(balances.values()) == 0


def test_balance_remainder_absorbed_by_payer():
    """割り切れない場合の端数処理: 支払者が吸収する"""
    costs = [CostEntry(payer_user_id=1, total_amount=1000, seikyusaki=[])]
    balances = build_balances(costs, member_ids=[1, 2, 3])
    # 1000 // 3 = 333, remainder 1 → payer absorbs remainder
    assert balances[1] == 1000 - 333 - 1  # 666
    assert balances[2] == -333
    assert balances[3] == -333
    assert sum(balances.values()) == 0


def test_balance_no_costs():
    """支出がない場合はすべてゼロ"""
    balances = build_balances([], member_ids=[1, 2, 3])
    assert all(v == 0 for v in balances.values())


def test_balance_four_members_multiple_payers():
    """4人・複数支払者"""
    costs = [
        CostEntry(payer_user_id=1, total_amount=4000, seikyusaki=[]),
        CostEntry(payer_user_id=2, total_amount=2000, seikyusaki=[]),
    ]
    balances = build_balances(costs, member_ids=[1, 2, 3, 4])
    assert balances[1] == 2500
    assert balances[2] == 500
    assert balances[3] == -1500
    assert balances[4] == -1500
    assert sum(balances.values()) == 0


# ─── calculate_settlements テスト ─────────────────────────────────────────────


def test_settlement_simple_two_members():
    """2人: シンプルな1件の送金"""
    balances = {1: 1000, 2: -1000}
    transfers = calculate_settlements(balances)
    assert len(transfers) == 1
    assert transfers[0] == (2, 1, 1000)
    assert _check_balanced(transfers, balances)


def test_settlement_three_members():
    """3人: 各残高をゼロにする"""
    balances = {1: 2000, 2: -1000, 3: -1000}
    transfers = calculate_settlements(balances)
    assert len(transfers) == 2
    assert _check_balanced(transfers, balances)


def test_settlement_four_members_two_debtors_two_creditors():
    """4人・2人が借り・2人が貸し"""
    balances = {1: 2500, 2: 500, 3: -1500, 4: -1500}
    transfers = calculate_settlements(balances)
    assert _check_balanced(transfers, balances)
    assert sum(t[2] for t in transfers) == 3000


def test_settlement_zero_balance_excluded():
    """残高ゼロのメンバーは送金に含まれない"""
    balances = {1: 1000, 2: 0, 3: -1000}
    transfers = calculate_settlements(balances)
    assert all(t[0] != 2 and t[1] != 2 for t in transfers)
    assert _check_balanced(transfers, balances)


def test_settlement_complex_five_members():
    """5人・複雑な清算ケース"""
    costs = [
        CostEntry(payer_user_id=1, total_amount=5000, seikyusaki=[]),
        CostEntry(payer_user_id=2, total_amount=3000, seikyusaki=[]),
        CostEntry(payer_user_id=3, total_amount=2000, seikyusaki=[]),
    ]
    balances = build_balances(costs, member_ids=[1, 2, 3, 4, 5])
    assert sum(balances.values()) == 0
    transfers = calculate_settlements(balances)
    assert _check_balanced(transfers, balances)


def test_settlement_all_equal_no_transfer():
    """全員が同額を支払った場合は転送なし"""
    costs = [
        CostEntry(payer_user_id=1, total_amount=1000, seikyusaki=[]),
        CostEntry(payer_user_id=2, total_amount=1000, seikyusaki=[]),
        CostEntry(payer_user_id=3, total_amount=1000, seikyusaki=[]),
    ]
    balances = build_balances(costs, member_ids=[1, 2, 3])
    assert all(v == 0 for v in balances.values())
    transfers = calculate_settlements(balances)
    assert transfers == []
