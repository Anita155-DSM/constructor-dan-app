import Obra from '../models/Obra.js';
import Presupuesto, { ItemPresupuesto } from '../models/Presupuesto.js';
import SemanaNomina, { PeonNomina } from '../models/Nomina.js';
import sequelize from '../config/database.js';

// ─── Listar todas las obras del usuario logueado ───────────────────────────
export const listarObras = async (req, res) => {
  try {
    const obras = await Obra.findAll({
      where: { usuario_id: req.usuario.id },
      order: [
        // Activas primero, luego pausadas, luego terminadas
        ['estado', 'ASC'],
        ['created_at', 'DESC'],
      ],
    });

    return res.json(obras);
  } catch (error) {
    console.error('Error al listar obras:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ─── Obtener una obra por ID ───────────────────────────────────────────────
export const obtenerObra = async (req, res) => {
  try {
    const obra = await Obra.findOne({
      where: {
        id: req.params.id,
        usuario_id: req.usuario.id, // Solo puede ver sus propias obras
      },
    });

    if (!obra) {
      return res.status(404).json({ error: 'Obra no encontrada.' });
    }

    return res.json(obra);
  } catch (error) {
    console.error('Error al obtener obra:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ─── Crear una obra nueva ──────────────────────────────────────────────────
export const crearObra = async (req, res) => {
  try {
    const {
      nombre_cliente,
      direccion,
      tipo,
      fecha_inicio,
      fecha_estimada_fin,
      notas,
    } = req.body;

    // Regla de negocio: si la obra es de tipo 'galpon',
    // se activa automáticamente la reserva del 20%.
    const reserva_herramienta_pct = tipo === 'galpon' ? 20 : 0;

    const obra = await Obra.create({
      usuario_id: req.usuario.id,
      nombre_cliente,
      direccion,
      tipo: tipo || 'normal',
      estado: 'activa',
      reserva_herramienta_pct,
      fecha_inicio: fecha_inicio || new Date(),
      fecha_estimada_fin: fecha_estimada_fin || null,
      notas: notas || null,
    });

    return res.status(201).json(obra);
  } catch (error) {
    // Errores de validación de Sequelize (campos vacíos, enums inválidos, etc.)
    if (error.name === 'SequelizeValidationError') {
      const mensajes = error.errors.map((e) => e.message);
      return res.status(400).json({ error: mensajes.join(', ') });
    }
    console.error('Error al crear obra:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ─── Editar una obra ───────────────────────────────────────────────────────
export const editarObra = async (req, res) => {
  try {
    const obra = await Obra.findOne({
      where: {
        id: req.params.id,
        usuario_id: req.usuario.id,
      },
    });

    if (!obra) {
      return res.status(404).json({ error: 'Obra no encontrada.' });
    }

    const {
      nombre_cliente,
      direccion,
      tipo,
      estado,
      fecha_estimada_fin,
      notas,
    } = req.body;

    // Si cambia a 'galpon', se activa la reserva; si vuelve a 'normal', se elimina.
    const reserva_herramienta_pct =
      tipo === 'galpon' ? 20 : tipo ? 0 : obra.reserva_herramienta_pct;

    await obra.update({
      nombre_cliente: nombre_cliente ?? obra.nombre_cliente,
      direccion: direccion ?? obra.direccion,
      tipo: tipo ?? obra.tipo,
      estado: estado ?? obra.estado,
      reserva_herramienta_pct,
      fecha_estimada_fin: fecha_estimada_fin ?? obra.fecha_estimada_fin,
      notas: notas ?? obra.notas,
    });

    return res.json(obra);
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      const mensajes = error.errors.map((e) => e.message);
      return res.status(400).json({ error: mensajes.join(', ') });
    }
    console.error('Error al editar obra:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ─── Cambiar estado de una obra (activa / pausada / terminada) ─────────────
// Endpoint separado para que el frontend tenga un botón simple de estado
export const cambiarEstado = async (req, res) => {
  try {
    const { estado } = req.body;
    const estadosValidos = ['activa', 'pausada', 'terminada'];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Usá: ${estadosValidos.join(', ')}` });
    }

    const obra = await Obra.findOne({
      where: { id: req.params.id, usuario_id: req.usuario.id },
    });

    if (!obra) {
      return res.status(404).json({ error: 'Obra no encontrada.' });
    }

    await obra.update({ estado });
    return res.json({ mensaje: `Obra marcada como "${estado}".`, obra });
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ─── Eliminar una obra ─────────────────────────────────────────────────────
// Borra en cascada presupuesto y nómina de la obra dentro de una transacción,
// para no dejar filas huérfanas (las tablas no tienen ON DELETE CASCADE real).
export const eliminarObra = async (req, res) => {
  const obra = await Obra.findOne({
    where: { id: req.params.id, usuario_id: req.usuario.id },
  });
  if (!obra) {
    return res.status(404).json({ error: 'Obra no encontrada.' });
  }

  let t;
  let committed = false;
  try {
    t = await sequelize.transaction();

    const presupuestos = await Presupuesto.findAll({
      where: { obra_id: obra.id }, attributes: ['id'], transaction: t,
    });
    if (presupuestos.length) {
      await ItemPresupuesto.destroy({
        where: { presupuesto_id: presupuestos.map(p => p.id) }, transaction: t,
      });
      await Presupuesto.destroy({ where: { obra_id: obra.id }, transaction: t });
    }

    const semanas = await SemanaNomina.findAll({
      where: { obra_id: obra.id }, attributes: ['id'], transaction: t,
    });
    if (semanas.length) {
      await PeonNomina.destroy({
        where: { semana_id: semanas.map(s => s.id) }, transaction: t,
      });
      await SemanaNomina.destroy({ where: { obra_id: obra.id }, transaction: t });
    }

    await obra.destroy({ transaction: t });
    await t.commit();
    committed = true;

    return res.json({ mensaje: 'Obra eliminada correctamente.' });
  } catch (error) {
    if (t && !committed) await t.rollback();
    console.error('Error al eliminar obra:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
