import express from 'express';
const app = express();
const http = require('http').Server(app);
const port : number = Number(process.env.NODE_PORT) || 3000;

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
            case "login":
                console.log("User logged in as", data.name);
                if (users.get(data.name)) {
                    sendTo(connection, {
                        type: "login",
                        success: false
                    });
                } else {
                    users.set(data.name, connection);
                    connection.name = data.name;
                    sendTo(connection, {
                        type: "login",
                        success: true
                    });
                }

                break;
            case "offer":
                console.log("Sending offer to", data.name);
                conn = users.get(data.name);

                if (conn != null) {
                    connection.otherName = data.name;
                    sendTo(conn, {
                        type: "offer",
                        offer: data.offer,
                        name: connection.name
                    });
                }

                break;
            case "answer":
                console.log("Sending answer to", data.name);
                conn  = users.get(data.name);

                if (conn != null) {
                    connection.otherName = data.name;
                    sendTo(conn, {
                        type: "answer",
                        answer: data.answer
                    });
                }

                break;
            case "candidate":
                console.log("Sending candidate to", data.name);
                conn = users.get(data.name);

                if (conn != null) {
                    sendTo(conn, {
                        type: "candidate",
                        candidate: data.candidate
                    });
                }

                break;
            case "leave":
                console.log("Disconnecting user from", data.name);
                conn = users.get(data.name);
                Object.assign(conn, { otherName: null });

                if (conn != null) {
                    sendTo(conn, {
                        type: "leave"
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
                        type: "leave"
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

http.listen(port, () => {
    process.send('ready');
    console.log('Listening on', port);
});

process.on('SIGINT', function () {
    http.close(function () {
        console.log('server closed');
        process.exit(0);
    })
});
