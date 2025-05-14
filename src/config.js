module.exports = {
    app: {
        port: process.env.PORT || 3000
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'tu_secreto_super_seguro',
        expiresIn: '24h'
    },
    db: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'dev_user',
        password: process.env.DB_PASSWORD || 'dev_password',
        database: process.env.DB_NAME || 'dev_database',
        port: process.env.DB_PORT || 3306
    }
};