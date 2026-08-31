import { Sequelize } from 'sequelize';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

let sequelize;

/**
 * Resuelve el certificado CA para la conexión SSL de producción.
 * Orden de búsqueda:
 *   1. process.env.DB_CA_CERT  → PEM completo o base64 (útil en Render, donde no
 *      se suben archivos).
 *   2. backend/ca.pem          → archivo local.
 *   3. null                    → sin CA. Se sigue usando SSL pero sin verificar
 *      la cadena (Aiven igual cifra el tráfico). Se avisa por consola.
 */
function resolverCA() {
  const fromEnv = process.env.DB_CA_CERT;
  if (fromEnv && fromEnv.trim()) {
    const raw = fromEnv.includes('BEGIN CERTIFICATE')
      ? fromEnv
      : Buffer.from(fromEnv, 'base64').toString('utf8');
    return raw;
  }

  const caPath = join(__dirname, '..', 'ca.pem');
  if (existsSync(caPath)) return readFileSync(caPath);

  console.warn(
    '[db] No se encontró certificado CA (DB_CA_CERT ni ca.pem). ' +
    'Se conecta con SSL pero sin verificar la cadena de certificados.'
  );
  return null;
}

if (process.env.DATABASE_URL) {
  // ── Producción: Aiven con SSL ─────────────────────────────────────────────
  // mysql2 no entiende parámetros como ssl-mode, sslmode, ssl, etc. en la URI.
  // Todo lo relacionado a SSL va en dialectOptions.
  const parsed = new URL(process.env.DATABASE_URL);

  const SSL_PARAMS = ['ssl-mode', 'sslmode', 'ssl', 'tls', 'require_secure_transport'];
  SSL_PARAMS.forEach(p => parsed.searchParams.delete(p));

  const cleanUrl = parsed.toString();
  const ca = resolverCA();

  sequelize = new Sequelize(cleanUrl, {
    dialect: 'mysql',
    dialectOptions: {
      ssl: ca
        ? { ca, rejectUnauthorized: true }
        : { rejectUnauthorized: false },
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
