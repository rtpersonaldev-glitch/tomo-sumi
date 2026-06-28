from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class CostEntry:
    payer_user_id: int
    total_amount: int
    seikyusaki: list[tuple[int, int]] = field(default_factory=list)
    """(debtor_user_id, amount) pairs — empty means equal split among members."""


def build_pairwise_debts(
    costs: list[CostEntry],
    member_ids: list[int],
) -> dict[tuple[int, int], int]:
    """Build gross pairwise debt map.

    debts[(a, b)] = amount means user a owes user b that amount (before netting).
    Equal-split remainder is absorbed by the payer.
    """
    member_set = set(member_ids)
    debts: dict[tuple[int, int], int] = defaultdict(int)

    for cost in costs:
        if cost.payer_user_id not in member_set:
            continue

        if cost.seikyusaki:
            for debtor_id, amount in cost.seikyusaki:
                if debtor_id == cost.payer_user_id or debtor_id not in member_set:
                    continue
                debts[(debtor_id, cost.payer_user_id)] += amount
        else:
            n = len(member_ids)
            if n == 0:
                continue
            share = cost.total_amount // n
            for uid in member_ids:
                if uid == cost.payer_user_id:
                    continue
                debts[(uid, cost.payer_user_id)] += share

    return debts


def calculate_pairwise_settlements(
    debts: dict[tuple[int, int], int],
) -> list[tuple[int, int, int]]:
    """Net each pair's debts and produce one transfer per pair if non-zero.

    Returns list of (from_user_id, to_user_id, amount).
    """
    processed: set[frozenset] = set()
    transfers: list[tuple[int, int, int]] = []

    for (a, b) in list(debts.keys()):
        pair: frozenset = frozenset([a, b])
        if pair in processed:
            continue
        processed.add(pair)

        a_owes_b = debts.get((a, b), 0)
        b_owes_a = debts.get((b, a), 0)
        net = a_owes_b - b_owes_a

        if net > 0:
            transfers.append((a, b, net))
        elif net < 0:
            transfers.append((b, a, -net))

    return transfers
