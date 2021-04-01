module.exports = {
    apps: [{
        name: 'app',
        script: './build/server.js',
        instances: 0,
        exec_mode: 'cluster',
        env: {
            NODE_PORT: "3100",
            NODE_ENV: "development",
            REDIS_HOST: "127.0.0.1",
            REDIS_PORT: 6379
        },
        env_production: {
            NODE_PORT: "3100",
            NODE_ENV: "production",
            REDIS_HOST: "127.0.0.1",
            REDIS_PORT: 6379
        },
        error_file: "./pm2-logs/error/err.log",
        out_file: "./pm2-logs/out/out.log"
    }]
}