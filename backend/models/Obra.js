import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Usuario from './Usuario.js';

const Obra = sequelize.define('Obra', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'usuarios', key: 'id' },
  },

  nombre_cliente: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'El nombre del cliente es obligatorio.' },
    },
  },

  direccion: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },

  tipo: {
    type: DataTypes.ENUM('normal', 'galpon', 'refaccion'),
    allowNull: false,
    defaultValue: 'normal',
  },

  estado: {
    type: DataTypes.ENUM('activa', 'terminada', 'pausada'),
    allowNull: false,
    defaultValue: 'activa',
  },

  reserva_herramienta_pct: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, max: 100 },
  },

  fecha_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },

  fecha_estimada_fin: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },

  notas: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'obras',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Relaciones
Obra.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'contratista' });
Usuario.hasMany(Obra,   { foreignKey: 'usuario_id', as: 'obras' });

export default Obra;
