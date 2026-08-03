import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Tu instancia de conexión a Sequelize

const Usuario = sequelize.define('Usuario', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'usuarios', // Asegúrate de que coincida con el nombre de tu tabla en MySQL/Postgres
  timestamps: true,
});

// 👈 ESTA ES LA LÍNEA CLAVE QUE FALTA O ESTÁ DENTRO DE MODULE.EXPORTS
export default Usuario;