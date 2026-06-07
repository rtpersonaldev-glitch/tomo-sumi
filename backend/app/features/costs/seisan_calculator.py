from dataclasses import dataclass, field


@dataclass
class CostEntry:
    payer_user_id: int
    total_amount: int
    seikyusaki: list[tuple[int, int]] = field(default_factory=list)
    """(debtor_user_id, amount) pairs — empty means equal split among members."""


def build_balances(
    costs: list[CostEntry],
    member_ids: list[int],
) -> dict[int, int]:
    """Build net balance map. Positive = owed to user. Negative = user owes."""
    balances: dict[int, int] = {uid: 0 for uid in member_ids}

    for cost in costs:
        if cost.payer_user_id not in balances:
            continue
        balances[cost.payer_user_id] += cost.total_amount

        if cost.seikyusaki:
            for debtor_id, amount in cost.seikyusaki:
                if debtor_id in balances:
                    balances[debtor_id] -= amount
        else:
            n = len(member_ids)
            if n == 0:
                continue
            share = cost.total_amount // n
            remainder = cost.total_amount % n
            for uid in member_ids:
                balances[uid] -= share
            balances[cost.payer_user_id] -= remainder

    return balances


def calculate_settlements(
    balances: dict[int, int],
) -> list[tuple[int, int, int]]:
    """Greedy algorithm to minimize transfers.

    Returns list of (from_user_id, to_user_id, amount).
    """
    creditors = [(uid, bal) for uid, bal in balances.items() if bal > 0]
    debtors = [(uid, -bal) for uid, bal in balances.items() if bal < 0]

    creditors.sort(key=lambda x: -x[1])
    debtors.sort(key=lambda x: -x[1])

    transfers: list[tuple[int, int, int]] = []
    ci, di = 0, 0

    while ci < len(creditors) and di < len(debtors):
        cuid, cbal = creditors[ci]
        duid, dbal = debtors[di]
        transfer = min(cbal, dbal)

        if transfer > 0:
            transfers.append((duid, cuid, transfer))

        creditors[ci] = (cuid, cbal - transfer)
        debtors[di] = (duid, dbal - transfer)

        if creditors[ci][1] == 0:
            ci += 1
        if debtors[di][1] == 0:
            di += 1

    return transfers
