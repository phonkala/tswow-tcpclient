const net = require('net');

const args = process.argv.slice(2);
const PORT = 8124;
const HOST = 'localhost';
const TCP_INITIAL_TIMEOUT = 1000;
const TCP_WAIT_MESSAGE_INTERVAL = 3000;
const TCP_MAX_EXECUTION_TIME = 20000;

const OutputCategory = {
    TCP_DEFAULT: "tcpclient",
    TCP_WARNING: "warning",
    TCP_ERROR: "error",
    TCP_CONNECTION: "connection",
    TCP_SERVER: "server"
};

function formatTerminalOutput(output, category) {
    const d = new Date();
    const time = `${d.getHours().toString().padStart(2, '0')}`
        + `:${d.getMinutes().toString().padStart(2, '0')}`
        + `:${d.getSeconds().toString().padStart(2, '0')}`;

    let formatted = `[\u001B[35m${time}\u001B[0m]`;

    let categories = Array.isArray(category) ? category : category ? [category] : [];

    // Always start with [tcpclient] unless categories include TCP_DEFAULT
    formatted += `[\u001B[32m${OutputCategory.TCP_DEFAULT}\u001B[0m]`;

    // Declare categoryColor and outputColor outside the switch
    let categoryColor = '\u001B[37m'; // Default white for category
    let outputColor = '\u001B[37m'; // Default white for output text

    // Process additional categories (exclude TCP_DEFAULT to avoid repetition)
    categories.forEach(cat => {
        if (cat !== OutputCategory.TCP_DEFAULT) { // Avoid repeating tcpclient
            switch (cat) {
                case OutputCategory.TCP_WARNING:
                    categoryColor = '\u001B[33m'; // Yellow
                    break;
                case OutputCategory.TCP_ERROR:
                    categoryColor = '\u001B[31m'; // Red
                    break;
                case OutputCategory.TCP_CONNECTION:
                    categoryColor = '\u001B[93m'; // Pale yellow
                    break;
                case OutputCategory.TCP_SERVER:
                    categoryColor = '\u001B[93m'; // Green
                    outputColor = '\u001B[93m'; // Green
                    break;
                default:
                    categoryColor = '\u001B[37m'; // Default white
                    outputColor = '\u001B[37m'; // Default white
                    break;
            }

            formatted += `[${categoryColor}${cat.replace("TCP_", "")}\u001B[0m]`; // Add category with the correct color
        }
    });

    // Now use outputColor for the output text
    formatted += ` ${outputColor}${output}\u001B[0m`; // Add the colored output text

    return formatted;
}


if (args.length === 0) {
console.error(formatTerminalOutput('No command provided. Usage: node tcpclient.js -c <command> [args...] or node tcpclient.js --command <command> [args...]', [OutputCategory.TCP_ERROR]));
    process.exit(1);
}

if (args.length < 2 || (args[0] !== '-c' && args[0] !== '--command') || args[1] === '') {
    console.error(formatTerminalOutput('Invalid usage. Usage: node tcpclient.js -c <command> [args...] or node tcpclient.js --command <command> [args...]', OutputCategory.TCP_ERROR));
    process.exit(1);
}

const command = args.slice(1).join(' ');

const client = new net.Socket();
let initialResponseTimeout;
let waitingMessageInterval;
let maxExecutionTimeout;

client.connect(PORT, HOST, () => {
    console.log(formatTerminalOutput('Connected to server.', OutputCategory.TCP_CONNECTION));
    client.write(command + '\n');
    initialResponseTimeout = setTimeout(() => {
        console.log(formatTerminalOutput('Running script, please wait...', OutputCategory.TCP_DEFAULT));
        waitingMessageInterval = setInterval(() => {
            console.log(formatTerminalOutput('Running script, please wait...', OutputCategory.TCP_DEFAULT));
        }, TCP_WAIT_MESSAGE_INTERVAL);
    }, TCP_INITIAL_TIMEOUT);
    maxExecutionTimeout = setTimeout(() => {
        console.error(formatTerminalOutput('Maximum execution time exceeded. Connection closed.', OutputCategory.TCP_CONNECTION));
        client.end();
        process.exit(1);
    }, TCP_MAX_EXECUTION_TIME);
});

let outputStarted = false;
let outputReceived = false;
client.on('data', (data) => {
    clearTimeout(initialResponseTimeout);
    clearInterval(waitingMessageInterval);
    const trimmedData = data.toString().trim();
    if (!outputStarted && trimmedData) {
        console.log(formatTerminalOutput('↓↓↓ BEGIN: Response from server ↓↓↓', OutputCategory.TCP_SERVER) + '\n');
        outputStarted = true; // Set flag to true to prevent printing it again
    }
    outputReceived = true;
    process.stdout.write(data);
});

client.on('close', () => {
    clearTimeout(initialResponseTimeout);
    clearInterval(waitingMessageInterval);
    clearTimeout(maxExecutionTimeout);
    if (outputReceived) {
        process.stdout.write('\n\n' + formatTerminalOutput('↑↑↑ END: Response from server ↑↑↑', OutputCategory.TCP_SERVER));
    }
    console.log('\n' + formatTerminalOutput('Connection closed.', OutputCategory.TCP_CONNECTION));
    process.exit(1);
});

client.on('error', (err) => {
    if (err.code !== 'ECONNRESET') {
        console.error(formatTerminalOutput('Connection error: ' + err, OutputCategory.TCP_ERROR));
    }
    process.exit(1);
});