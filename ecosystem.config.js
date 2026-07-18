const dotenv = require('dotenv');
const path = require('path');

// Membaca file .env secara otomatis dari folder aplikasi
dotenv.config({ path: path.join(__dirname, '.env') });

module.exports = {
    apps: [
        {
            name: 'beechat-app',
            script: './dist/server.cjs',
            cwd: '/home/vmdemo/beechat',
            watch: ['dist'],
            ignore_watch: ['node_modules', '.git', '.env'],
            env: {
                NODE_ENV: 'production',
                ...process.env
            }
        }
    ]
};
