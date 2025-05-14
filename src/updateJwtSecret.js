const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

try {
    // Leer el archivo .env actual
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Generar nuevo JWT_SECRET
    const newSecret = crypto.randomBytes(64).toString('hex');
    
    // Actualizar el JWT_SECRET en el contenido
    envContent = envContent.replace(
        /JWT_SECRET=.*/,
        `JWT_SECRET=${newSecret}`
    );
    
    // Escribir el archivo actualizado
    fs.writeFileSync(envPath, envContent);
    
    console.log('JWT_SECRET actualizado exitosamente');
} catch (error) {
    console.error('Error al actualizar JWT_SECRET:', error);
}