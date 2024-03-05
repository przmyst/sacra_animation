async function moveTo(stepper, position, acceleration, velocity) {
    stepper.setAcceleration(acceleration);
    stepper.setVelocityLimit(velocity);

    // Check if the requested move is less than 1 in absolute terms.
    // If so, adjust the position to ensure a move is attempted.
    // This is crucial for high-precision tasks where even tiny movements matter.
    const currentPosition = await stepper.getPosition(); // Assuming getPosition() is an available method.
    if (Math.abs(position - currentPosition) < 1) {
        // If the move is very small, we directly resolve the promise,
        // assuming the stepper might not trigger a position change event for such a small distance.
        // Alternatively, adjust the 'position' by a minimal amount to ensure the motor attempts to move,
        // and the onPositionChange event can be triggered.
        position = currentPosition + (position > currentPosition ? 1 : -1);
    }

    stepper.setTargetPosition(position);

    return new Promise((resolve, reject) => {
        const onPositionChange = (newPosition) => {
            if (Math.abs(newPosition - position) < 1) {
                stepper.onPositionChange = () => {}; // Detach the event listener.
                resolve(); // Resolve the promise as we are close enough to the target position.
            }
        };

        stepper.onPositionChange = onPositionChange;

        // Implementing a timeout for rejection in case the position is never reached
        // could also be a good idea to prevent the promise from hanging indefinitely.
        const timeout = setTimeout(() => {
            stepper.onPositionChange = () => {};
            reject(new Error("Timed out waiting for the stepper to reach the target position"));
        }, 10000); // Timeout after 10000 ms (10 seconds)

        // Ensure to clear the timeout upon successful completion
        stepper.onPositionChange = (newPosition) => {
            if (Math.abs(newPosition - position) < 1) {
                clearTimeout(timeout);
                stepper.onPositionChange = () => {};
                resolve();
            }
        };
    });
}
