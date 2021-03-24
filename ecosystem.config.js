module.exports = {
    apps: [{
        name: 'app',
        script: './build/server.js',
        instances: 0,
        exec_mode: 'cluster',
        wait_ready: true,
        listen_timeout: 50000,
        kill_timeout: 5000,
        env: {
            NODE_PORT: "3100",
            NODE_ENV: "development"
        },
        env_production: {
            NODE_PORT: "3100",
            NODE_ENV: "production"
        },
        error_file: "./log/err.log",
        out_file: "./log/out.log"
    }]
}