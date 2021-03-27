import express from 'express';
import redis from 'redis';
const publisher = redis.createClient({host:"127.0.0.1", port:6379, db: 0});
const subscriber = redis.createClient({host:"127.0.0.1", port:6379, db: 0});
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
const users = new Map<string, object>();
const sessionUsers = new Set<string>();

subscriber.on("message", (channel, message) => {
    const info = JSON.parse(message);
    let conn;

    switch (channel) {
        case METHOD_NAME.Login:
            sessionUsers.add(info.name);
            break;
        case METHOD_NAME.Offer:
            conn = users.get(info.data.name);
            if (conn != null) {
                console.log(`subscribe Offer is not null`);
                console.log(`info.connection.name : ${info.connection.name}`);
                sendTo(conn, {
                    type: METHOD_NAME.Offer,
                    offer: info.data.offer,
                    name: info.connection.name
                });
            } else {
                console.log(`subscribe Offer is null`);
            }
            break;
        case METHOD_NAME.Candidate:
            conn = users.get(info.data.name);
            if (conn != null) {
                console.log(`subscribe Candidate is not null`);
                sendTo(conn, {
                    type: METHOD_NAME.Candidate,
                    candidate: info.data.candidate
                });
            } else {
                console.log(`subscribe Candidate is null`);
            }
        case METHOD_NAME.Answer:
            conn  = users.get(info.data.name);
            if (conn != null) {
                console.log(`subscribe Answer is not null`);
                sendTo(conn, {
                    type: METHOD_NAME.Answer,
                    answer: info.data.answer
                });
            } else {
                console.log(`subscribe Answer is null`);
            }
            break;
        case METHOD_NAME.Leave:
            conn = users.get(info.data.name);
            if (conn != null) {
                console.log(`type Leave - conn is not null`);
                Object.assign(conn, { otherName: null });
                sendTo(conn, {
                        type: METHOD_NAME.Leave
                });
            } else {
                console.log(`subscribe Leave is null`);
            }
            break;
        case METHOD_NAME.Close:
            conn = users.get(info.initUser);
            if (conn != null) {
                console.log(`type Close - conn is not null`);
                Object.assign(conn, { otherName: null });
                sendTo(conn, {
                    type: METHOD_NAME.Leave
                });
            } else {
                console.log(`type Close - conn is null`);
            }
            break;
        case METHOD_NAME.DeleteSessionUser:
            sessionUsers.delete(info.leftUser);
            break;
        default:
    }
});
subscriber.subscribe(METHOD_NAME.Login);
subscriber.subscribe(METHOD_NAME.Offer);
subscriber.subscribe(METHOD_NAME.Candidate);
subscriber.subscribe(METHOD_NAME.Answer);
subscriber.subscribe(METHOD_NAME.Leave);
subscriber.subscribe(METHOD_NAME.Close);
subscriber.subscribe(METHOD_NAME.DeleteSessionUser);

wss.on('connection', (connection: any) => {
    connection.on('message', async (message: string) => {
    
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
                console.log("----------User logged in as", data.name);
                if (sessionUsers.has(data.name)) {
                    sendTo(connection, {
                        type: METHOD_NAME.Login,
                        success: false
                    });
                } else {
                    users.set(data.name, connection);
                    publisher.publish(METHOD_NAME.Login, JSON.stringify({ name: data.name }));
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
                    console.log(`type Offer - conn is not null`);
                    connection.otherName = data.name;
                    sendTo(conn, {
                        type: METHOD_NAME.Offer,
                        offer: data.offer,
                        name: connection.name
                    });
                } else {
                    console.log(`type Offer - conn is null`);
                    connection.otherName = data.name;
                    publisher.publish(METHOD_NAME.Offer, JSON.stringify({ data: data, connection: connection }));
                }
                break;
            case METHOD_NAME.Answer:
                console.log("Sending answer to", data.name);
                conn  = users.get(data.name);

                if (conn != null) {
                    console.log(`type Answer - conn is not null`);
                    connection.otherName = data.name;
                    sendTo(conn, {
                        type: METHOD_NAME.Answer,
                        answer: data.answer
                    });
                } else {
                    console.log(`type Answer - conn is null`);
                    connection.otherName = data.name;
                    publisher.publish(METHOD_NAME.Answer, JSON.stringify({ data: data, connection: connection }));
                }

                break;
            case METHOD_NAME.Candidate:
                console.log("Sending candidate to", data.name);
                conn = users.get(data.name);

                if (conn != null) {
                    console.log(`type Candidate - conn is not null`);
                    sendTo(conn, {
                        type: METHOD_NAME.Candidate,
                        candidate: data.candidate
                    });
                } else {
                    console.log(`type Candidate - conn is null`);
                    publisher.publish(METHOD_NAME.Candidate, JSON.stringify({ data: data }));
                }

                break;
            case METHOD_NAME.Leave:
                console.log("Disconnecting user from", data.name);
                conn = users.get(data.name);

                if (conn != null) {
                    console.log(`type Leave - conn is not null`);
                    Object.assign(conn, { otherName: null });
                    sendTo(conn, {
                        type: METHOD_NAME.Leave
                    });
                } else {
                    console.log(`type Leave - conn is null`);
                    publisher.publish(METHOD_NAME.Leave, JSON.stringify({ data: data }));
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
            publisher.publish(METHOD_NAME.DeleteSessionUser, JSON.stringify({ leftUser: connection.name }));
            if (connection.otherName) {
                console.log("Disconnecting user from", connection.otherName);
                let conn = users.get(connection.otherName);
                if (conn != null) {
                    Object.assign(conn, { otherName: null });
                    sendTo(conn, {
                        type: METHOD_NAME.Leave
                    });
                } else {
                    publisher.publish(METHOD_NAME.Close, JSON.stringify({ initUser: connection.otherName }));
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
