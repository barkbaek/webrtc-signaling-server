import express from 'express';
import redis from 'redis';
import ioredis from 'ioredis';
import { METHOD_NAME } from './shared/common_types';
const logger = require('../config/winston').logger;
const app = express();
const http = require('http').Server(app);
const port : number = Number(process.env.NODE_PORT) || 3000;
let redisConfig : object = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT, 
    db: 0
};
const publisher = redis.createClient(redisConfig);
const subscriber = redis.createClient(redisConfig);
Object.assign(redisConfig, { family: 4 });
const ioRedis = new ioredis(redisConfig);

console.log(process.pid);

app.use(express.static(__dirname + '/public'));

const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({ port: 8888 });
const users = new Map<string, object>();

subscriber.on("message", async (channel, message) => {
    const info = JSON.parse(message);
    let conn
        , c;

    switch (channel) {
        case METHOD_NAME.Login:
            await ioRedis.sadd("sessionUsers", info.name);
            break;
        case METHOD_NAME.Offer:
            c = await ioRedis.hget(`users:${process.pid}`, info.toUser);

            if (c != null) {
                conn = users.get(info.toUser);
                console.log(`subscribe Offer is not null`);
                console.log(`info.fromUser : ${info.fromUser}`);
                sendTo(conn, {
                    type: METHOD_NAME.Offer,
                    offer: info.offer,
                    name: info.fromUser
                });
            } else {
                console.log(`subscribe Offer is null`);
            }
            break;
        case METHOD_NAME.Candidate:
            c = await ioRedis.hget(`users:${process.pid}`, info.toUser);
            
            if (c != null) {
                conn = users.get(info.toUser);
                console.log(`subscribe Candidate is not null`);
                sendTo(conn, {
                    type: METHOD_NAME.Candidate,
                    candidate: info.candidate
                });
            } else {
                console.log(`subscribe Candidate is null`);
            }
        case METHOD_NAME.Answer:
            c = await ioRedis.hget(`users:${process.pid}`, info.toUser);

            if (c != null) {
                conn = users.get(info.toUser);
                console.log(`subscribe Answer is not null`);
                sendTo(conn, {
                    type: METHOD_NAME.Answer,
                    answer: info.answer
                });
            } else {
                console.log(`subscribe Answer is null`);
            }
            break;
        case METHOD_NAME.Leave:
        case METHOD_NAME.Close:
            c = await ioRedis.hget(`users:${process.pid}`, info.initUser);

            if (c != null) {
                conn = users.get(info.initUser);
                console.log(`subscribe Leave, Close - conn is not null`);
                Object.assign(conn, { otherName: null });
                sendTo(conn, {
                    type: METHOD_NAME.Leave
                });
            } else {
                console.log(`subscribe Leave, Close - conn is null`);
            }
            break;
        case METHOD_NAME.DeleteSessionUser:
            await ioRedis.srem("sessionUsers", info.leftUser);
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
            , conn
            , c;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log("Error parsing JSON");
            data = {};
        }

        switch (data.type) {
            case METHOD_NAME.Login:
                console.log("----------User logged in as", data.name);
                const result = await ioRedis.sismember("sessionUsers", data.name);
                if (result === 1) {
                    sendTo(connection, {
                        type: METHOD_NAME.Login,
                        success: false
                    });
                } else {
                    publisher.publish(METHOD_NAME.Login, JSON.stringify({ name: data.name }));
                    connection.name = data.name;
                    users.set(data.name, connection);
                    await ioRedis.hset(`users:${process.pid}`, data.name, data.name); // 사실 인메모리 users만 사용하여 기능 구현 가능하지만(필요 없지만) hash 연습을 위해 사용.
                    sendTo(connection, {
                        type: METHOD_NAME.Login,
                        success: true
                    });
                }
                break;
            case METHOD_NAME.Offer:
                console.log("Sending offer to", data.name);
                c = await ioRedis.hget(`users:${process.pid}`, data.name);

                if (c != null) {
                    conn = users.get(data.name);
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
                    publisher.publish(METHOD_NAME.Offer, JSON.stringify({ offer: data.offer, fromUser:connection.name, toUser: data.name }));
                }
                break;
            case METHOD_NAME.Answer:
                console.log("Sending answer to", data.name);
                c = await ioRedis.hget(`users:${process.pid}`, data.name);

                if (c != null) {
                    conn = users.get(data.name);
                    console.log(`type Answer - conn is not null`);
                    connection.otherName = data.name;
                    sendTo(conn, {
                        type: METHOD_NAME.Answer,
                        answer: data.answer
                    });
                } else {
                    console.log(`type Answer - conn is null`);
                    connection.otherName = data.name;
                    publisher.publish(METHOD_NAME.Answer, JSON.stringify({ answer: data.answer, toUser: data.name }));
                }

                break;
            case METHOD_NAME.Candidate:
                console.log("Sending candidate to", data.name);
                c = await ioRedis.hget(`users:${process.pid}`, data.name);

                if (c != null) {
                    conn = users.get(data.name);
                    console.log(`type Candidate - conn is not null`);
                    sendTo(conn, {
                        type: METHOD_NAME.Candidate,
                        candidate: data.candidate
                    });
                } else {
                    console.log(`type Candidate - conn is null`);
                    publisher.publish(METHOD_NAME.Candidate, JSON.stringify({ candidate: data.candidate, toUser: data.name }));
                }

                break;
            case METHOD_NAME.Leave:
                console.log("Disconnecting user from", data.name);
                c = await ioRedis.hget(`users:${process.pid}`, data.name);

                if (c != null) {
                    conn = users.get(data.name);
                    console.log(`type Leave - conn is not null`);
                    Object.assign(conn, { otherName: null });
                    sendTo(conn, {
                        type: METHOD_NAME.Leave
                    });
                } else {
                    console.log(`type Leave - conn is null`);
                    publisher.publish(METHOD_NAME.Leave, JSON.stringify({ initUser: data.name }));
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

    connection.on('close', async () => {
        if (connection.name) {
            users.delete(connection.name);
            await ioRedis.hdel(`users:${process.pid}`, connection.name);
            publisher.publish(METHOD_NAME.DeleteSessionUser, JSON.stringify({ leftUser: connection.name }));
            if (connection.otherName) {
                console.log("Disconnecting user from", connection.otherName);
                const c = await ioRedis.hget(`users:${process.pid}`, connection.otherName);
                if (c != null) {
                    let conn = users.get(connection.otherName);
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
    try {
        conn.send(JSON.stringify(message));
    } catch (e) {
        console.log(`sendTo error: ${e}`);
    }
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

app.get('/hset', async (req, res) => {
    await ioRedis.hset("users", "a", JSON.stringify({connection: "conn is a"}));
    res.send("hset");
});

app.get('/hget', async (req, res) => {
    const data = await ioRedis.hget("users", "a");
    const info = JSON.parse(data);
    console.log(`hget - info: `);
    console.dir(info);
    // 비어 있으면 null이 나옴.
    res.send("hget");
});

app.get('/hdel', async (req, res) => {
    await ioRedis.hdel("users", "a");
    res.send("hdel");
});

app.get('/sadd', async (req, res) => {
    await ioRedis.sadd("sessionUsers", "a");
    res.send("sadd");
});

app.get('/srem', async (req, res) => {
    await ioRedis.srem("sessionUsers", "a");
    res.send("srem");
});

app.get('/sismember', async (req, res) => {
    const result = await ioRedis.sismember("sessionUsers", "a");
    console.log(`sismember - result: ${result}, type: ${typeof result}`);
    // 있을 경우 1. 없을 경우 0. type은 number
    res.send("sismember");
});

http.listen(port, () => {
    console.log('Listening on', port);
});

process.on('SIGINT', function () {
    http.close(async function () {
        console.log('server closed');
        await ioRedis.flushall();
        process.exit(0);
    })
});
