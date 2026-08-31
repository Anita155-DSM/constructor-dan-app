import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Obra from '../models/Obra.js';
import Presupuesto from '../models/Presupuesto.js';
import SemanaNomina from '../models/Nomina.js';

// ─── Saldo de una obra específica ────────────────────────────────────────────
export const obtenerSaldo = async (req, res) => {
  try {
    const { obraId } = req.params;

    const obra = await Obra.findOne({
      where: { id: obraId, usuario_id: req.usuario.id },
    });
    if (!obra) return res.status(404).json({ error: 'Obra no encontrada.' });

    // Presupuesto aprobado
    const presupuesto = await Presupuesto.findOne({
      where: { obra_id: obraId, aprobado: true },
    });

    // Todas las semanas de nómina para calcular lo cobrado
    const semanas = await SemanaNomina.findAll({
      where: { obra_id: obraId },
      attributes: ['id', 'fecha_lunes', 'monto_recibido', 'ganancia_contratista', 'reserva_herramienta', 'total_nomina_peones'],
      order: [['fecha_lunes', 'ASC']],
    });

    const totalPresupuestado = presupuesto ? parseFloat(presupuesto.total_con_rebaja) : 0;
    const totalCobrado       = semanas.reduce((s, w) => s + parseFloat(w.monto_recibido), 0);
    const saldoPendiente     = parseFloat((totalPresupuestado - totalCobrado).toFixed(2));
    const pctCobrado         = totalPresupuestado > 0
      ? Math.min(100, parseFloat(((totalCobrado / totalPresupuestado) * 100).toFixed(1)))
      : 0;

    // Ganancia acumulada (suma de todas las semanas)
    const gananciaAcumulada  = semanas.reduce((s, w) => s + parseFloat(w.ganancia_contratista), 0);
    const reservaAcumulada   = semanas.reduce((s, w) => s + parseFloat(w.reserva_herramienta), 0);

    return res.json({
      obra: {
        id: obra.id,
        nombre_cliente: obra.nombre_cliente,
        tipo: obra.tipo,
        estado: obra.estado,
        reserva_herramienta_pct: obra.reserva_herramienta_pct,
      },
      presupuesto: presupuesto ? {
        total_con_rebaja:  parseFloat(presupuesto.total_con_rebaja),
        precio_ofertado:   parseFloat(presupuesto.precio_ofertado),
        ganancia_rebaja:   parseFloat(presupuesto.ganancia_rebaja),
        aprobado:          presupuesto.aprobado,
      } : null,
      resumen: {
        total_presupuestado: totalPresupuestado,
        total_cobrado:       parseFloat(totalCobrado.toFixed(2)),
        saldo_pendiente:     saldoPendiente,
        pct_cobrado:         pctCobrado,
        ganancia_acumulada:  parseFloat(gananciaAcumulada.toFixed(2)),
        reserva_acumulada:   parseFloat(reservaAcumulada.toFixed(2)),
        cantidad_semanas:    semanas.length,
      },
      // Historial semana a semana para el desglose
      semanas: semanas.map(w => ({
        id:                  w.id,
        fecha_lunes:         w.fecha_lunes,
        monto_recibido:      parseFloat(w.monto_recibido),
        total_nomina_peones: parseFloat(w.total_nomina_peones),
        reserva_herramienta: parseFloat(w.reserva_herramienta),
        ganancia_contratista:parseFloat(w.ganancia_contratista),
      })),
    });
  } catch (err) {
    console.error('Error en saldos:', err);
    return res.status(500).json({ error: 'Error interno.' });
  }
};

// ─── Resumen general de TODAS las obras (para el dashboard futuro) ────────────
export const resumenGeneral = async (req, res) => {
  try {
    const obras = await Obra.findAll({
      where: { usuario_id: req.usuario.id },
      attributes: ['id', 'nombre_cliente', 'estado', 'tipo'],
    });

    const resultados = await Promise.all(obras.map(async (obra) => {
      const presupuesto = await Presupuesto.findOne({
        where: { obra_id: obra.id, aprobado: true },
        attributes: ['total_con_rebaja'],
      });
      const [agg] = await sequelize.query(`
        SELECT
          COALESCE(SUM(monto_recibido), 0)       AS total_cobrado,
          COALESCE(SUM(ganancia_contratista), 0)  AS ganancia_total
        FROM semanas_nomina
        WHERE obra_id = :obraId
      `, { replacements: { obraId: obra.id }, type: QueryTypes.SELECT });

      const totalPresupuestado = presupuesto ? parseFloat(presupuesto.total_con_rebaja) : 0;
      const totalCobrado       = parseFloat(agg.total_cobrado);

      return {
        id:                  obra.id,
        nombre_cliente:      obra.nombre_cliente,
        estado:              obra.estado,
        tipo:                obra.tipo,
        total_presupuestado: totalPresupuestado,
        total_cobrado:       totalCobrado,
        saldo_pendiente:     parseFloat((totalPresupuestado - totalCobrado).toFixed(2)),
        ganancia_total:      parseFloat(parseFloat(agg.ganancia_total).toFixed(2)),
        tiene_presupuesto:   !!presupuesto,
      };
    }));

    // Solo obras activas primero
    resultados.sort((a, b) => {
      if (a.estado === 'activa' && b.estado !== 'activa') return -1;
      if (b.estado === 'activa' && a.estado !== 'activa') return 1;
      return 0;
    });

    const totales = {
      total_por_cobrar:    resultados.reduce((s, o) => s + Math.max(0, o.saldo_pendiente), 0),
      ganancia_total:      resultados.reduce((s, o) => s + o.ganancia_total, 0),
      obras_activas:       resultados.filter(o => o.estado === 'activa').length,
    };

    return res.json({ obras: resultados, totales });
  } catch (err) {
    console.error('Error en resumen general:', err);
    return res.status(500).json({ error: 'Error interno.' });
  }
};
