import { Sequelize } from 'sequelize';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

let sequelize;

if (process.env.DATABASE_URL) {
  // ── Producción: Aiven con SSL ──────────────────────────────────────────────
  // Separamos la URI de las opciones SSL — NO incluir ?ssl-mode=... en la URI.
  // Aiven requiere el certificado CA para verificar el servidor.
  const caPem = readFileSync(join(__dirname, '..', 'ca.pem'));

  // Limpiar cualquier parámetro ssl-mode que pueda venir en la URI
  const dbUrl = process.env.DATABASE_URL.replace(/[?&]ssl-mode=[^&]*/gi, '');

  sequelize = new Sequelize(dbUrl, {
    dialect: 'mysql',
    dialectModule: (await import('mysql2')).default,
    dialectOptions: {
      ssl: {
        ca:                 caPem,
        rejectUnauthorized: true,
      },
    },
    logging: false,
  });
} else {
  // ── Desarrollo local: XAMPP sin SSL ───────────────────────────────────────
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host:    process.env.DB_HOST    || 'localhost',
      port:    process.env.DB_PORT    || 3306,
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
