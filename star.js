const { createCanvas } = require('canvas');
const GIFEncoder = require('gifencoder');
const fs = require('fs');
const WIDTH = 800
const HEIGHT = 800
const canvas = createCanvas(WIDTH, HEIGHT);
let ctx = canvas.getContext('2d');
let encoder = new GIFEncoder(WIDTH, HEIGHT);
const path = require('path');

// Constants for the manipulator's geometry
const thetaShoulderMax = 360;
const thetaShoulderMin = -360;
const ShoulderLength = 195;

const thetaElbowMax = 145;
const thetaElbowMin = -145;
const ElbowLength = 200;

function calculateInverseKinematics(x, y) {
    y =y * 1.5
    let L1 = ShoulderLength;
    let L2 = ElbowLength;
    const D = (x ** 2 + y ** 2 - L1 ** 2 - L2 ** 2) / (2 * L1 * L2);
    if (Math.abs(D) > 1) {
        return [null, null]; // Target is not reachable
    }
    let theta2 = Math.atan2(-Math.sqrt(1 - D ** 2), D);
    let theta1 = Math.atan2(y, x) - Math.atan2(L2 * Math.sin(theta2), L1 + L2 * Math.cos(theta2));

    // Convert radians to degrees
    theta1 = theta1 * (180 / Math.PI);
    theta2 = theta2 * (180 / Math.PI);

    // Adjust theta1 and theta2 to be within their respective limits
    if (theta1 < thetaShoulderMin) theta1 = thetaShoulderMin;
    else if (theta1 > thetaShoulderMax) theta1 = thetaShoulderMax;

    if (theta2 < thetaElbowMin) theta2 = thetaElbowMin;
    else if (theta2 > thetaElbowMax) theta2 = thetaElbowMax;

    // After adjusting, check if the target is still reachable with the new theta values
    // This is a simple approach and might need refinement for your specific requirements
    const cosTheta2 = Math.cos(theta2 * (Math.PI / 180));
    const sinTheta2 = Math.sin(theta2 * (Math.PI / 180));
    const cosTheta1 = Math.cos(theta1 * (Math.PI / 180));
    const sinTheta1 = Math.sin(theta1 * (Math.PI / 180));

    const recalculatedX = L1 * cosTheta1 + L2 * cosTheta1 * cosTheta2 - L2 * sinTheta1 * sinTheta2;
    const recalculatedY = L1 * sinTheta1 + L2 * sinTheta1 * cosTheta2 + L2 * cosTheta1 * sinTheta2;

    // A simple distance check could be used to see if the recalculated position is close enough to the target
    // This threshold can be adjusted based on the precision needs of your application
    const distanceToTarget = Math.sqrt((recalculatedX - x) ** 2 + (recalculatedY - y) ** 2);
    if (distanceToTarget > 10) { // Assuming a threshold of 10 units for the distance to the target
        return [null, null]; // Target is not reachable within the angle limits
    }

    return [theta1, theta2];
}
let lastPosition = null;
let points = []
function drawSCARAArm(targetX, targetY, penDown) {
    // Calculate the angles for shoulder and elbow to reach the target
    const [theta1, theta2] = calculateInverseKinematics(targetX - (WIDTH/2), targetY - (HEIGHT/2));
    if (theta1 === null || theta2 === null) {
        console.log("Target is not reachable.");
        return; // Target is not reachable
    }

    // Convert angles back to radians for Math functions
    const theta1Rad = theta1 * (Math.PI / 180);
    const theta2Rad = theta2 * (Math.PI / 180);

    // Calculate elbow position
    const elbowX = (WIDTH/2) + ShoulderLength * Math.cos(theta1Rad);
    const elbowY = (HEIGHT/2) + ShoulderLength * Math.sin(theta1Rad);

    // Calculate hand (end effector) position using elbow as the origin
    const handX = elbowX + ElbowLength * Math.cos(theta1Rad + theta2Rad);
    const handY = elbowY + ElbowLength * Math.sin(theta1Rad + theta2Rad);
    ctx.clearRect(0, 0, WIDTH, HEIGHT)

        // Drawing the arm

    ctx.beginPath();
    ctx.moveTo((WIDTH/2), (HEIGHT/2)); // Start from the shoulder position
    ctx.lineTo(elbowX, elbowY); // Draw to elbow
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'green'; // Color of the arm
    ctx.lineWidth = 2; // Line width of the arm
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(elbowX, elbowY);
    ctx.lineTo(handX, handY); // Draw to hand (end effector)
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'blue'; // Color of the arm
    ctx.lineWidth = 2; // Line width of the arm
    ctx.stroke();

    if (penDown && lastPosition) {
        // Store the line segment as an object with start and end points
        points.push({
            start: { x: lastPosition.x, y: lastPosition.y },
            end: { x: handX, y: handY }
        });
    }

    // Update last position
    lastPosition = { x: handX, y: handY };

    // Draw stored line segments
    ctx.beginPath();
    for (const segment of points) {
        ctx.moveTo(segment.start.x, segment.start.y);
        ctx.lineTo(segment.end.x, segment.end.y);
    }
    ctx.strokeStyle = 'red';
    ctx.stroke();

}

function interpolatePoints(x1, y1, x2, y2, steps) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
        const x = x1 + ((x2 - x1) * i) / steps;
        const y = y1 + ((y2 - y1) * i) / steps;
        points.push({ x, y });
    }
    return points;
}
let last_skipped = false
async function animateArmMovement(startX, startY, endX, endY) {
    const points = interpolatePoints(startX, startY, endX, endY, 30);
    let shouldDraw
    if(last_skipped){
       shouldDraw = true
       last_skipped = false
    }else{
        shouldDraw = Math.random() > 0.75
        last_skipped = true
    }
    for (const point of points) {
        drawSCARAArm(point.x, point.y, shouldDraw);
        encoder.addFrame(ctx);
    }
}

function isPointReachable(x, y) {
    const [theta1, theta2] = calculateInverseKinematics(x - (WIDTH/2), y - (HEIGHT/2));
    return theta1 !== null && theta2 !== null;
}


// Function to generate a random point within canvas bounds
function getRandomPointWithinReach(maxWidth, maxHeight) {
    // Adjust center to target the top right quadrant more specifically
    const centerX = maxWidth * 0.65; // Move the center towards the right side of the canvas
    const centerY = maxHeight * 0.35; // Move the center upwards

    const maxReach = ShoulderLength + ElbowLength - 10; // Slight buffer to ensure reachability

    // Generate a random angle for Quadrant 1 (top right)
    // This will focus on generating points in the desired quadrant
    const angle = Math.random() * Math.PI / 2; // Random angle in radians, focusing on 0 to π/2

    // Random radius within reach, ensuring it's positive
    const radius = Math.random() * maxReach;

    // Calculate x and y based on angle and radius
    // Ensure they fall within the specified quadrant by adjusting the radius and angle calculation
    const x = centerX + radius * Math.cos(angle);
    const y = centerY - radius * Math.sin(angle); // Subtract because the y-axis is inverted

    return { x, y };
}

async function animateRandomLines(numberOfLines) {
    let startPoint = getRandomPointWithinReach(WIDTH, HEIGHT); // Initial start point

    // Ensure the initial start point is reachable; if not, try again until a reachable point is found
    while (!isPointReachable(startPoint.x, startPoint.y)) {
        startPoint = getRandomPointWithinReach(WIDTH, HEIGHT);
    }

    let endPoint;
    for (let i = 0; i < numberOfLines; i++) {
        do {
            endPoint = getRandomPointWithinReach(WIDTH, HEIGHT);
        } while (!isPointReachable(endPoint.x, endPoint.y)); // Keep looking for a reachable endPoint

        // Before drawing a new line, lift the pen and move to the start position without drawing
        drawSCARAArm(startPoint.x, startPoint.y, false); // Move without drawing
        encoder.addFrame(ctx);

        // Now draw to the end point
        console.log(`Moving from (${startPoint.x}, ${startPoint.y}) to (${endPoint.x}, ${endPoint.y})`);
        await animateArmMovement(startPoint.x, startPoint.y, endPoint.x, endPoint.y);

        // Update startPoint for the next line to start from the previous end point
        startPoint = endPoint;
    }

    return true;
}




// Function to save GIF with a monotonic name
function saveGIF(buffer) {
    const dir = path.join(__dirname, 'generated_gifs');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    const filename = `scara_drawing_${Date.now()}.gif`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer, 'binary');
    console.log(`Animation completed and saved as ${filename}`);
}


// Example usage
async function main() {
    points = []
    ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,WIDTH, HEIGHT)
    encoder = new GIFEncoder(WIDTH, HEIGHT);
    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(100);
    encoder.setQuality(10);

    let result = await animateRandomLines(Math.floor(Math.random() * 16) + 3);
    if(result === true) {
        encoder.finish();
        const buffer = encoder.out.getData();
        saveGIF(buffer);
    }

    await main()
}

main();
