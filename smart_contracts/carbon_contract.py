from beaker import *
from pyteal import *


class CarbonState:
    """Per-wallet local state for CampusCarbon."""
    electricity = LocalStateValue(stack_type=TealType.uint64, descr="Electricity usage kWh")
    solar = LocalStateValue(stack_type=TealType.uint64, descr="Solar generation kWh")
    carbon_saved = LocalStateValue(stack_type=TealType.uint64, descr="Carbon saved kg CO2")
    green_score = LocalStateValue(stack_type=TealType.uint64, descr="Green score 0-100")
    bill_hash = LocalStateValue(stack_type=TealType.uint64, descr="Bill proof hash (first 8 bytes)")
    solar_hash = LocalStateValue(stack_type=TealType.uint64, descr="Solar proof hash (first 8 bytes)")
    tokens_earned = LocalStateValue(stack_type=TealType.uint64, descr="Carbon tokens earned")
    has_badge = LocalStateValue(stack_type=TealType.uint64, descr="1 if NFT badge earned")


class CarbonApp(Application):
    pass


app = CarbonApp("CampusCarbonApp", state=CarbonState)


@app.create
def create():
    return Approve()


@app.opt_in
def opt_in():
    """Initialize local state to zero on opt-in."""
    return Seq(
        app.state.electricity.set(Int(0)),
        app.state.solar.set(Int(0)),
        app.state.carbon_saved.set(Int(0)),
        app.state.green_score.set(Int(0)),
        app.state.bill_hash.set(Int(0)),
        app.state.solar_hash.set(Int(0)),
        app.state.tokens_earned.set(Int(0)),
        app.state.has_badge.set(Int(0)),
    )


@app.external
def submit_data(
    electricity: abi.Uint64,
    solar: abi.Uint64,
    carbon_saved: abi.Uint64,
    green_score: abi.Uint64,
    bill_hash: abi.Uint64,
    solar_hash: abi.Uint64,
):
    """Submit campus energy data with anti-cheat validation."""
    # Calculate tokens: 1 token per 100 kg CO2 saved
    tokens = ScratchVar(TealType.uint64)
    badge = ScratchVar(TealType.uint64)

    return Seq(
        # ─── ANTI-CHEAT VALIDATIONS ───
        # Electricity must be > 0
        Assert(electricity.get() > Int(0)),
        # Solar cannot exceed electricity
        Assert(solar.get() <= electricity.get()),
        # Green score must be 0-100
        Assert(green_score.get() <= Int(100)),
        # Carbon saved must be reasonable
        Assert(carbon_saved.get() <= Int(50000)),

        # ─── Calculate Rewards ───
        tokens.store(carbon_saved.get() / Int(100)),
        # Badge if green_score >= 80
        If(green_score.get() >= Int(80))
        .Then(badge.store(Int(1)))
        .Else(badge.store(Int(0))),

        # ─── Store All Data in Local State ───
        app.state.electricity.set(electricity.get()),
        app.state.solar.set(solar.get()),
        app.state.carbon_saved.set(carbon_saved.get()),
        app.state.green_score.set(green_score.get()),
        app.state.bill_hash.set(bill_hash.get()),
        app.state.solar_hash.set(solar_hash.get()),
        app.state.tokens_earned.set(
            app.state.tokens_earned + tokens.load()
        ),
        app.state.has_badge.set(badge.load()),
    )


if __name__ == "__main__":
    app.build().export("./artifacts")
