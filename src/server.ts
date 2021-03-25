import express from 'express';
const logger = require('../config/winston').logger;
const app = express();
const http = require('http').Server(app);
const port : number = Number(process.env.NODE_PORT) || 3000;
const { METHOD_NAME } = require('./shared/common_types');

console.log(__dirname);

app.use(express.static(__dirname + '/public'));
/*
interface Users {
    [key: string]: object
}
*/

const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({ port: 8888 });
let users = new Map<string, object>();

wss.on('connection', (connection: any) => {
    connection.on('message', (message: string) => {
        let data
            , conn;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log("Error parsing JSON");
            data = {};
        }

        switch (data.type) {
            case METHOD_NAME.Login:
                console.log("User logged in as", data.name);
                if (users.get(data.name)) {
                    sendTo(connection, {
                        type: METHOD_NAME.Login,
                        success: false
                    });
                } else {
                    users.set(data.name, connection);
                    connection.name = data.name;
                    sendTo(connection, {
                        type: METHOD_NAME.Login,
                        success: true
                    });
                }

                break;
            case METHOD_NAME.Offer:
                console.log("Sending offer to", data.name);
                conn = users.get(data.name);

                if (conn != null) {
                    connection.otherName = data.name;
                    sendTo(conn, {
                        type: METHOD_NAME.Offer,
                        offer: data.offer,
                        name: connection.name
                    });
                }

                break;
            case METHOD_NAME.Answer:
                console.log("Sending answer to", data.name);
                conn  = users.get(data.name);

                if (conn != null) {
                    connection.otherName = data.name;
                    sendTo(conn, {
                        type: METHOD_NAME.Answer,
                        answer: data.answer
                    });
                }

                break;
            case METHOD_NAME.Candidate:
                console.log("Sending candidate to", data.name);
                conn = users.get(data.name);

                if (conn != null) {
                    sendTo(conn, {
                        type: METHOD_NAME.Candidate,
                        candidate: data.candidate
                    });
                }

                break;
            case METHOD_NAME.Leave:
                console.log("Disconnecting user from", data.name);
                conn = users.get(data.name);
                Object.assign(conn, { otherName: null });

                if (conn != null) {
                    sendTo(conn, {
                        type: METHOD_NAME.Leave
                    });
                }

                break;
            default:
                sendTo(connection, {
                    type: "error",
                    message: "Unrecognized command: " + data.type
                });
                break;
        }
    });

    connection.on('close', () => {
        if (connection.name) {
            users.delete(connection.name);

            if (connection.otherName) {
                console.log("Disconnecting user from", connection.otherName);
                let conn = users.get(connection.otherName);
                Object.assign(conn, { otherName: null });
            
                if (conn != null) {
                    sendTo(conn, {
                        type: METHOD_NAME.Leave
                    });
                }
            }
        }
    });
});

const sendTo = (conn: any, message: object) => {
    conn.send(JSON.stringify(message));
};

wss.on('listening', () => {
    console.log("Server started...");
});

app.get('/winston', (req, res) => {
    logger.info('This is info for winston logger.')
    res.send("/winston info");
});

app.get('/error', (req, res) => {
    logger.error('This is error for winston logger.');
    res.send("/winston error");
});

http.listen(port, () => {
    console.log('Listening on', port);
});

process.on('SIGINT', function () {
    http.close(function () {
        console.log('server closed');
        process.exit(0);
    })
});
