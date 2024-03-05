const { createCanvas } = require('canvas');
const GIFEncoder = require('gifencoder');
const fs = require('fs');
const canvas = createCanvas(800, 600);
const ctx = canvas.getContext('2d');

const encoder = new GIFEncoder(800, 600);
encoder.start();
encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
encoder.setDelay(100); // Frame delay in ms
encoder.setQuality(10); // Image quality. 1 - 20

// Constants for the manipulator's geometry
const thetaShoulderMax = 90;
const thetaShoulderMin = -90;
const ShoulderLength = 200;

const thetaElbowMax = 145;
const thetaElbowMin = -145;
const ElbowLength = 195;

let thetaShoulder = 0;
let thetaElbow = 145;

function calculateInverseKinematics(x, y) {
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

let points = []
function drawSCARAArm(targetX, targetY, penDown) {
    // Calculate the angles for shoulder and elbow to reach the target
    const [theta1, theta2] = calculateInverseKinematics(targetX - 400, targetY - 300);
    if (theta1 === null || theta2 === null) {
        console.log("Target is not reachable.");
        return; // Target is not reachable
    }

    // Convert angles back to radians for Math functions
    const theta1Rad = theta1 * (Math.PI / 180);
    const theta2Rad = theta2 * (Math.PI / 180);

    // Calculate elbow position
    const elbowX = 400 + ShoulderLength * Math.cos(theta1Rad);
    const elbowY = 300 + ShoulderLength * Math.sin(theta1Rad);

    // Calculate hand (end effector) position using elbow as the origin
    const handX = elbowX + ElbowLength * Math.cos(theta1Rad + theta2Rad);
    const handY = elbowY + ElbowLength * Math.sin(theta1Rad + theta2Rad);

    // Drawing the arm
    ctx.clearRect(0,0,800,600)
    ctx.beginPath();
    ctx.moveTo(400, 300); // Start from the shoulder position
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

    ctx.beginPath();
    points.push([handX, handY])
    ctx.strokeStyle = 'red';
    for(let point of points){
        ctx.ellipse(point[0], point[1], 1, 1, 0 ,0, 0);

    }
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

async function animateArmMovement(startX, startY, endX, endY) {
    const points = interpolatePoints(startX, startY, endX, endY, 20);
    for (const point of points) {
        drawSCARAArm(point.x, point.y, true);
        encoder.addFrame(ctx);
    }
}

// Draw text inside square
const squareCorners = [{'x': 633.3333333333334, 'y': 195.95598854801193},
    {'x': 654.1146802222061, 'y': 238.06359652578246},
    {'x': 700.5831845297291, 'y': 244.81586544422564},
    {'x': 666.9582589315312, 'y': 277.5920672778872},
    {'x': 674.8960271110788, 'y': 323.87280694843514},
    {'x': 633.3333333333334, 'y': 302.02200572599406},
    {'x': 591.770639555588, 'y': 323.87280694843514},
    {'x': 599.7084077351356, 'y': 277.5920672778872},
    {'x': 566.0834821369376, 'y': 244.81586544422564},
    {'x': 612.5519864444607, 'y': 238.0635965257825},
    {'x': 633.3333333333334, 'y': 195.95598854801193}]

async function animateSquare() {
    for (let i = 0; i < squareCorners.length - 1; i++) {
        await animateArmMovement(squareCorners[i].x, squareCorners[i].y, squareCorners[i + 1].x, squareCorners[i + 1].y);
    }
    encoder.finish();
    const buffer = encoder.out.getData();
    fs.writeFileSync('scara_star.gif', buffer, 'binary');
}

animateSquare();


