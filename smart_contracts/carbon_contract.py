from beaker import *
from pyteal import *


class CarbonState:
    """State container for CampusCarbon app."""
    electricity = LocalStateValue(stack_type=TealType.uint64, descr="Electricity usage")
    solar = LocalStateValue(stack_type=TealType.uint64, descr="Solar generation")
    carbon_saved = LocalStateValue(stack_type=TealType.uint64, descr="Carbon saved")
    green_score = LocalStateValue(stack_type=TealType.uint64, descr="Green score")


class CarbonApp(Application):
    pass


app = CarbonApp("CampusCarbonApp", state=CarbonState)

@app.create
def create():
    return Approve()

@app.opt_in
def opt_in():
    return Approve()

@app.external
def submit_data(
    electricity: abi.Uint64,
    solar: abi.Uint64,
    carbon_saved: abi.Uint64,
    green_score: abi.Uint64
):
    return Seq(
        # Validation: Solar <= Electricity
        Assert(solar.get() <= electricity.get()),
        
        # Store in Local State (Sender's account)
        app.state.electricity.set(electricity.get()),
        app.state.solar.set(solar.get()),
        app.state.carbon_saved.set(carbon_saved.get()),
        app.state.green_score.set(green_score.get())
    )

if __name__ == "__main__":
    app.build().export("./artifacts")
