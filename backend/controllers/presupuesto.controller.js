import Presupuesto, { ItemPresupuesto, RENDIMIENTOS } from '../models/Presupuesto.js';
import Obra from '../models/Obra.js';
import sequelize from '../config/database.js'; // ✅ FIX CRÍTICO: faltaban llaves

function calcularBolsas(tipo, cantidad) {
  const r = RENDIMIENTOS[tipo];
  if (!r) return null; // ✅ ya no tira error — ítems sin rendimiento devuelven null
  let bolsas;
  if (tipo === 'hormigon' || tipo === 'contrapiso') {
    bolsas = Math.ceil(cantidad * 7);
  } else {
    bolsas = Math.ceil(cantidad / r.rinde);
  }
  return { bolsas, material: r.material, kg_por_bolsa: r.kg, unidad: r.unidad };
}

function calcularRebaja(precio_ofertado, pct_rebaja) {
  const factor           = 1 - (pct_rebaja / 100);
  const total_con_rebaja = parseFloat((precio_ofertado * factor).toFixed(2));
  const ganancia_rebaja  = parseFloat((precio_ofertado - total_con_rebaja).toFixed(2));
  return { total_con_rebaja, ganancia_rebaja };
}

// ─── Simular rebaja sin guardar ─────────────────────────────────────────────
export const simularRebaja = (req, res) => {
  try {
    const { precio_ofertado, pct_rebaja = 0 } = req.body;
    if (precio_ofertado == null) return res.status(400).json({ error: 'precio_ofertado es obligatorio.' });
    const resultado = calcularRebaja(parseFloat(precio_ofertado), parseFloat(pct_rebaja));
    return res.json(resultado);
  } catch (err) {
    console.error('Error en simularRebaja:', err);
    return res.status(500).json({ error: 'Error interno.' });
  }
};

// ─── Calcular materiales (preview de bolsas) sin persistir ───────────────────
export const calcularMateriales = (req, res) => {
  try {
    const { items = [] } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items debe ser un arreglo.' });

    const resultado = items.map((item) => {
      const tieneRendimiento = !!RENDIMIENTOS[item.tipo_trabajo];
      const calc = tieneRendimiento ? calcularBolsas(item.tipo_trabajo, parseFloat(item.cantidad || 0)) : null;
      return {
        tipo_trabajo: item.tipo_trabajo || 'personalizado',
        descripcion:  item.descripcion || item.tipo_trabajo || 'Ítem personalizado',
        cantidad:     parseFloat(item.cantidad || 0),
        bolsas:       calc ? calc.bolsas : 0,
        material:     calc ? calc.material : '-',
        kg_por_bolsa: calc ? calc.kg_por_bolsa : 0,
        unidad:       item.unidad || (calc ? calc.unidad : 'unidad'),
      };
    });

    return res.json({ items: resultado });
  } catch (err) {
    console.error('Error en calcularMateriales:', err);
    return res.status(500).json({ error: 'Error interno.' });
  }
};

// ─── GET presupuesto — devuelve objeto plano o 404 ───────────────────────────
export const obtenerPresupuesto = async (req, res) => {
  try {
    const { obraId } = req.params;
    const obra = await Obra.findOne({ where: { id: obraId, usuario_id: req.usuario.id } });
    if (!obra) return res.status(404).json({ error: 'Obra no encontrada.' });

    const presupuesto = await Presupuesto.findOne({
      where: { obra_id: obraId },
      include: [{ model: ItemPresupuesto, as: 'items' }],
      order: [['created_at', 'DESC']],
    });

    if (!presupuesto) return res.status(404).json({ error: 'Sin presupuesto.' });
    return res.json(presupuesto); // ✅ objeto plano directo
  } catch (error) {
    console.error('Error al obtener presupuesto:', error);
    return res.status(500).json({ error: 'Error interno.' });
  }
};

// ─── POST crear/reemplazar presupuesto ───────────────────────────────────────
export const crearPresupuesto = async (req, res) => {
  const { obraId } = req.params;
  const { precio_ofertado, pct_rebaja = 0, items = [], notas } = req.body;

  // Validaciones ANTES de abrir la transacción: si algo falla acá, no queda
  // ninguna transacción colgada consumiendo conexiones del pool.
  if (!precio_ofertado || parseFloat(precio_ofertado) <= 0)
    return res.status(400).json({ error: 'El precio ofertado es obligatorio.' });
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Agregá al menos un ítem.' });

  const obra = await Obra.findOne({ where: { id: obraId, usuario_id: req.usuario.id } });
  if (!obra) return res.status(404).json({ error: 'Obra no encontrada.' });

  let t;
  let committed = false;
  try {
    t = await sequelize.transaction();

    const { total_con_rebaja, ganancia_rebaja } = calcularRebaja(
      parseFloat(precio_ofertado), parseFloat(pct_rebaja)
    );

    await Presupuesto.destroy({ where: { obra_id: obraId }, transaction: t });

    const presupuesto = await Presupuesto.create({
      obra_id:         obraId,
      precio_m2:       parseFloat(req.body.precio_m2 || 0),
      precio_ofertado: parseFloat(precio_ofertado),
      pct_rebaja:      parseFloat(pct_rebaja),
      total_con_rebaja,
      ganancia_rebaja,
      aprobado: false,
      notas: notas || null,
    }, { transaction: t });

    const itemsParaGuardar = items.map((item) => {
      const tieneRendimiento = !!RENDIMIENTOS[item.tipo_trabajo];
      const calc = tieneRendimiento ? calcularBolsas(item.tipo_trabajo, parseFloat(item.cantidad)) : null;
      const precioUnit = parseFloat(item.precio_unitario || 0);
      const cant       = parseFloat(item.cantidad || 1);
      return {
        presupuesto_id:    presupuesto.id,
        tipo_trabajo:      item.tipo_trabajo || 'personalizado',
        descripcion:       item.descripcion  || item.tipo_trabajo || 'Ítem personalizado',
        cantidad:          cant,
        precio_unitario:   precioUnit,
        subtotal:          parseFloat((precioUnit * cant).toFixed(2)),
        bolsas_calculadas: calc ? calc.bolsas : 0,
        material:          calc ? calc.material : '-',
        kg_por_bolsa:      calc ? calc.kg_por_bolsa : 0,
        unidad:            item.unidad || (calc ? calc.unidad : 'unidad'),
      };
    });

    await ItemPresupuesto.bulkCreate(itemsParaGuardar, { transaction: t });
    await t.commit();
    committed = true;

    const resultado = await Presupuesto.findByPk(presupuesto.id, {
      include: [{ model: ItemPresupuesto, as: 'items' }],
    });
    return res.status(201).json(resultado);
  } catch (error) {
    if (t && !committed) await t.rollback();
    console.error('Error al crear presupuesto:', error);
    return res.status(500).json({ error: error.message || 'Error interno.' });
  }
};

// ─── PATCH aprobar ────────────────────────────────────────────────────────────
export const aprobarPresupuesto = async (req, res) => {
  try {
    const { obraId } = req.params;
    const obra = await Obra.findOne({ where: { id: obraId, usuario_id: req.usuario.id } });
    if (!obra) return res.status(404).json({ error: 'Obra no encontrada.' });

    const presupuesto = await Presupuesto.findOne({ where: { obra_id: obraId } });
    if (!presupuesto) return res.status(404).json({ error: 'No hay presupuesto para aprobar.' });

    await presupuesto.update({ aprobado: true });
    return res.json({ mensaje: 'Presupuesto aprobado.', presupuesto });
  } catch (error) {
    console.error('Error al aprobar:', error);
    return res.status(500).json({ error: 'Error interno.' });
  }
};
