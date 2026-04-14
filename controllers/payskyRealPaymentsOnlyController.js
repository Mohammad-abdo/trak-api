/** Real-payments-only guard for all old simulation entry points. */

export function payskyTripSimulationAllowed() {
    return false;
}

export const payskySimulateTripPayment = async (req, res) => {
    return res.status(403).json({
        success: false,
        message: "PaySky simulation is permanently disabled. Only real gateway payments are allowed.",
    });
};
