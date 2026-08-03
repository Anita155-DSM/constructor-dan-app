import { DataTypes } from 'sequelize';
import  sequelize  from '../config/database.js';
import  Usuario  from './Usuario.js';
import Obra from './Obra.js';

// ─── Peones frecuentes ───────────────────────────────────────────────────────
// Agenda de peones habituales de Dan. Se precargan al abrir la nómina semanal.
export const PeonFrecuente = sequelize.define('PeonFrecuente', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuario_id: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'usuarios', key: 'id' },
  },
  nombre: {
    type: DataTypes.STRING(80), allowNull: false,
    validate: { notEmpty: { msg: 'El nombre es obligatorio.' } },
  },
  rol: {
    type: DataTypes.ENUM('ayudante', 'oficial', 'contratista'),
    allowNull: false, defaultValue: 'ayudante',
  },
  jornal_default: {
    type: DataTypes.DECIMAL(8, 2), allowNull: false,
    validate: { min: { args: [0], msg: 'El jornal no puede ser negativo.' } },
  },
}, {
  tableName: 'peones_frecuentes',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

// ─── Semana de nómina ────────────────────────────────────────────────────────
// Una por semana por obra. Guarda el pago del patrón y los totales calculados.
export const SemanaNomina = sequelize.define('SemanaNomina', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  obra_id: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'obras', key: 'id' },
  },
  // Lunes de la semana — identifica unívocamente la semana
  fecha_lunes: { type: DataTypes.DATEONLY, allowNull: false },
  // Lo que el patrón (o su chofer) pagó esa semana
  monto_recibido: {
    type: DataTypes.DECIMAL(12, 2), allowNull: false,
    validate: { min: { args: [0], msg: 'El monto no puede ser negativo.' } },
  },
  quien_pago: { type: DataTypes.STRING(80), allowNull: true },
  // Calculados al guardar
  total_nomina_peones:  { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  reserva_herramienta:  { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  ganancia_contratista: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  notas: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'semanas_nomina',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

// ─── Peón en una semana ──────────────────────────────────────────────────────
export const PeonNomina = sequelize.define('PeonNomina', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  semana_id: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'semanas_nomina', key: 'id' },
  },
  nombre:         { type: DataTypes.STRING(80), allowNull: false },
  rol:            { type: DataTypes.ENUM('ayudante', 'oficial', 'contratista'), allowNull: false, defaultValue: 'ayudante' },
  jornal_diario:  { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  dias_trabajados:{ type: DataTypes.TINYINT, allowNull: false, defaultValue: 0, validate: { min: 0, max: 7 } },
  // Ej: ["lunes","miercoles"] — días que faltó
  ausencias:      { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  // jornal_diario * dias_trabajados
  total_peon:     { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
}, {
  tableName: 'nomina_peones',
  timestamps: false,
});

// ─── Relaciones ──────────────────────────────────────────────────────────────
PeonFrecuente.belongsTo(Usuario,     { foreignKey: 'usuario_id' });
SemanaNomina.belongsTo(Obra,         { foreignKey: 'obra_id', as: 'obra' });
Obra.hasMany(SemanaNomina,           { foreignKey: 'obra_id', as: 'semanas' });
SemanaNomina.hasMany(PeonNomina,     { foreignKey: 'semana_id', as: 'peones' });
PeonNomina.belongsTo(SemanaNomina,   { foreignKey: 'semana_id' });

export default SemanaNomina;
