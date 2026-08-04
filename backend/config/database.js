import { Sequelize } from 'sequelize';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

let sequelize;

if (process.env.DATABASE_URL) {
  // ── Producción: Aiven con SSL ─────────────────────────────────────────────
  // Usamos la clase URL para parsear y limpiar la URI correctamente.
  // mysql2 no entiende parámetros como ssl-mode, sslmode, ssl, etc.
  // Todo lo relacionado a SSL va en dialectOptions, no en la URI.
  const parsed = new URL(process.env.DATABASE_URL);

  // Eliminar TODOS los parámetros SSL del query string
  const SSL_PARAMS = ['ssl-mode', 'sslmode', 'ssl', 'tls', 'require_secure_transport'];
  SSL_PARAMS.forEach(p => parsed.searchParams.delete(p));

  const cleanUrl = parsed.toString();

  // Leer el certificado CA de Aiven
  // Descargarlo desde: Aiven Console → tu servicio → Overview → CA Certificate
  const caPem = readFileSync(join(__dirname, '..', 'ca.pem'));

  sequelize = new Sequelize(cleanUrl, {
    dialect: 'mysql',
    dialectOptions: {
      ssl: {
        ca:                 caPem,
        rejectUnauthorized: true,
      },
    },
    logging: false,
  });

} else {
  // ── Desarrollo local: XAMPP sin SSL ──────────────────────────────────────
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host:    process.env.DB_HOST    || 'localhost',
      port:    parseInt(process.env.DB_PORT) || 3306,
      dialect: process.env.DB_DIALECT || 'mysql',
      logging: false,
    }
  );
}

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexión a la base de datos establecida correctamente.');
    await sequelize.sync({ force: false });
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
    process.exit(1);
  }
};

export default sequelize;
