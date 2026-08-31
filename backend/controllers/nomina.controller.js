import SemanaNomina, { PeonNomina, PeonFrecuente } from '../models/Nomina.js';
import Obra from '../models/Obra.js';
import  sequelize  from '../config/database.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Devuelve el lunes de la semana de una fecha dada (o de hoy)
function getLunes(fecha = new Date()) {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0=dom ... 6=sab
  d.setDate(d.getDate() + (dia === 0 ? -6 : 1 - dia));
  return d.toISOString().split('T')[0];
}

// Semana de 6 días (lun-sab). dias_trabajados = 6 - ausencias
function calcularDias(ausencias = []) {
  return Math.max(0, 6 - ausencias.length);
}

// Verificar que la obra pertenece al usuario
async function verificarObra(obraId, usuarioId) {
  return Obra.findOne({ where: { id: obraId, usuario_id: usuarioId } });
}

// ─── Listar historial de semanas de una obra ─────────────────────────────────
export const listarSemanas = async (req, res) => {
  try {
    const obra = await verificarObra(req.params.obraId, req.usuario.id);
    if (!obra) return res.status(404).json({ error: 'Obra no encontrada.' });

    const semanas = await SemanaNomina.findAll({
      where: { obra_id: req.params.obraId },
      include: [{ model: PeonNomina, as: 'peones' }],
      order: [['fecha_lunes', 'DESC']],
    });
    return res.json(semanas);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno.' });
  }
};

// ─── Obtener semana actual (precargada con peones frecuentes si no existe) ───
export const obtenerSemanaActual = async (req, res) => {
  try {
    const obra = await verificarObra(req.params.obraId, req.usuario.id);
    if (!obra) return res.status(404).json({ error: 'Obra no encontrada.' });

    const fechaLunes = getLunes();
    const semana = await SemanaNomina.findOne({
      where: { obra_id: req.params.obraId, fecha_lunes: fechaLunes },
      include: [{ model: PeonNomina, as: 'peones' }],
    });

    if (!semana) {
      // No existe semana todavía → devolver peones frecuentes para precargar el form
      const frecuentes = await PeonFrecuente.findAll({
        where: { usuario_id: req.usuario.id },
        order: [['rol', 'ASC'], ['nombre', 'ASC']],
      });
      return res.json({
        existe: false,
        fecha_lunes: fechaLunes,
        reserva_herramienta_pct: obra.reserva_herramienta_pct,
        peones_sugeridos: frecuentes.map(p => ({
          nombre: p.nombre,
          rol: p.rol,
          jornal_diario: p.jornal_default,
          ausencias: [],
        })),
      });
    }

    return res.json({ existe: true, reserva_herramienta_pct: obra.reserva_herramienta_pct, ...semana.toJSON() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno.' });
  }
};

// ─── Guardar nómina de una semana ────────────────────────────────────────────
export const guardarNomina = async (req, res) => {
  const { obraId } = req.params;
  const { fecha_lunes, monto_recibido, quien_pago, peones = [], notas } = req.body;

  // Validar antes de abrir la transacción para no dejar conexiones colgadas.
  if (monto_recibido == null || parseFloat(monto_recibido) < 0)
    return res.status(400).json({ error: 'El monto recibido es obligatorio.' });
  if (!Array.isArray(peones) || peones.length === 0)
    return res.status(400).json({ error: 'Agregá al menos un peón (incluso vos mismo).' });

  const obra = await verificarObra(obraId, req.usuario.id);
  if (!obra) return res.status(404).json({ error: 'Obra no encontrada.' });

  let t;
  let committed = false;
  try {
    t = await sequelize.transaction();

    const semanaKey = fecha_lunes || getLunes();
    const montoNum  = parseFloat(monto_recibido);

    // Calcular totales de cada peón
    const peonesCalc = peones.map(p => {
      const ausencias      = p.ausencias || [];
      const dias_trabajados = calcularDias(ausencias);
      const total_peon     = parseFloat((parseFloat(p.jornal_diario) * dias_trabajados).toFixed(2));
      return { ...p, dias_trabajados, ausencias, total_peon };
    });

    const total_nomina_peones = parseFloat(
      peonesCalc.reduce((s, p) => s + p.total_peon, 0).toFixed(2)
    );
    const reserva_herramienta = parseFloat(
      (montoNum * (obra.reserva_herramienta_pct / 100)).toFixed(2)
    );
    const ganancia_contratista = parseFloat(
      (montoNum - total_nomina_peones - reserva_herramienta).toFixed(2)
    );

    // Si ya existe semana para esta fecha → reemplazar
    const existente = await SemanaNomina.findOne({
      where: { obra_id: obraId, fecha_lunes: semanaKey },
    });

    let semana;
    if (existente) {
      await PeonNomina.destroy({ where: { semana_id: existente.id }, transaction: t });
      await existente.update({
        monto_recibido: montoNum, quien_pago: quien_pago || null,
        total_nomina_peones, reserva_herramienta, ganancia_contratista,
        notas: notas || null,
      }, { transaction: t });
      semana = existente;
    } else {
      semana = await SemanaNomina.create({
        obra_id: obraId, fecha_lunes: semanaKey,
        monto_recibido: montoNum, quien_pago: quien_pago || null,
        total_nomina_peones, reserva_herramienta, ganancia_contratista,
        notas: notas || null,
      }, { transaction: t });
    }

    await PeonNomina.bulkCreate(
      peonesCalc.map(p => ({
        semana_id: semana.id,
        nombre: p.nombre, rol: p.rol || 'ayudante',
        jornal_diario: parseFloat(p.jornal_diario),
        dias_trabajados: p.dias_trabajados,
        ausencias: p.ausencias, total_peon: p.total_peon,
      })),
      { transaction: t }
    );

    await t.commit();
    committed = true;

    // Actualizar agenda de peones frecuentes silenciosamente
    for (const p of peonesCalc) {
      try {
        const [peon] = await PeonFrecuente.findOrCreate({
          where: { usuario_id: req.usuario.id, nombre: p.nombre },
          defaults: { rol: p.rol || 'ayudante', jornal_default: parseFloat(p.jornal_diario) },
        });
        // Actualizar jornal si cambió
        if (parseFloat(peon.jornal_default) !== parseFloat(p.jornal_diario)) {
          await peon.update({ jornal_default: parseFloat(p.jornal_diario), rol: p.rol || peon.rol });
        }
      } catch { /* silencioso */ }
    }

    const resultado = await SemanaNomina.findByPk(semana.id, {
      include: [{ model: PeonNomina, as: 'peones' }],
    });
    return res.status(existente ? 200 : 201).json(resultado);
  } catch (err) {
    if (t && !committed) await t.rollback();
    console.error(err);
    return res.status(500).json({ error: err.message || 'Error interno.' });
  }
};

// ─── Peones frecuentes ───────────────────────────────────────────────────────
export const listarFrecuentes = async (req, res) => {
  try {
    const peones = await PeonFrecuente.findAll({
      where: { usuario_id: req.usuario.id },
      order: [['rol', 'ASC'], ['nombre', 'ASC']],
    });
    return res.json(peones);
  } catch { return res.status(500).json({ error: 'Error interno.' }); }
};

export const eliminarFrecuente = async (req, res) => {
  try {
    const peon = await PeonFrecuente.findOne({
      where: { id: req.params.peonId, usuario_id: req.usuario.id },
    });
    if (!peon) return res.status(404).json({ error: 'Peón no encontrado.' });
    await peon.destroy();
    return res.json({ mensaje: 'Eliminado de la agenda.' });
  } catch { return res.status(500).json({ error: 'Error interno.' }); }
};
