import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Obra from './Obra.js';

export const RENDIMIENTOS = {
  carpeta:        { material: 'cemento',   kg: 50, rinde: 7,   unidad: 'm2' },
  reboque:        { material: 'cal',       kg: 25, rinde: 6,   unidad: 'm2' },
  piso_ceramico:  { material: 'pegamento', kg: 30, rinde: 6,   unidad: 'm2' },
  ceramico_pared: { material: 'cal',       kg: 25, rinde: 6,   unidad: 'm2' },
  pared_comun:    { material: 'cal',       kg: 25, rinde: 3,   unidad: 'm2' },
  hormigon_viga:  { material: 'cemento',   kg: 50, rinde: 3,   unidad: 'ml' },
  contrapiso:     { material: 'cemento',   kg: 50, rinde: 1/7, unidad: 'm3', esVolumen: true },
  hormigon:       { material: 'cemento',   kg: 50, rinde: 1/7, unidad: 'm3', esVolumen: true },
};

const Presupuesto = sequelize.define('Presupuesto', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  obra_id:         { type: DataTypes.INTEGER, allowNull: false },
  precio_m2:       { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  precio_ofertado: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  pct_rebaja:      { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
  total_con_rebaja:{ type: DataTypes.DECIMAL(12, 2), allowNull: false },
  ganancia_rebaja: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  aprobado:        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  notas:           { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'presupuestos',
  timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
});

export const ItemPresupuesto = sequelize.define('ItemPresupuesto', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  presupuesto_id: { type: DataTypes.INTEGER, allowNull: false },

  tipo_trabajo:   { type: DataTypes.STRING(50), allowNull: false },
  // ✅ descripción libre para ítems personalizados
  descripcion:    { type: DataTypes.STRING(200), allowNull: true },

  cantidad:       { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 1 },
  unidad:         { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'unidad' },

  // Precio por unidad del ítem (m², unidad fija, etc.)
  precio_unitario:{ type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  subtotal:       { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

  // Solo para ítems de construcción con rendimiento de bolsas
  bolsas_calculadas: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
  material:          { type: DataTypes.STRING(30), allowNull: false, defaultValue: '-' },
  kg_por_bolsa:      { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'items_presupuesto',
  timestamps: false,
});

Presupuesto.belongsTo(Obra, { foreignKey: 'obra_id', as: 'obra' });
Obra.hasMany(Presupuesto, { foreignKey: 'obra_id', as: 'presupuestos' });
Presupuesto.hasMany(ItemPresupuesto, { foreignKey: 'presupuesto_id', as: 'items' });
ItemPresupuesto.belongsTo(Presupuesto, { foreignKey: 'presupuesto_id' });

export default Presupuesto;
