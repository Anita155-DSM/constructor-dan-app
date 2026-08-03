import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario.js';
import { connectDB } from '../config/database.js';

(async () => {
  await connectDB();

  const email = process.env.TEST_USER_EMAIL || 'test+expo@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'Password123!';
  const nombre = 'Tester Expo';

  try {
    const hash = await bcrypt.hash(password, 10);
    let usuario = await Usuario.findOne({ where: { email } });
    if (usuario) {
      await usuario.update({ nombre, password_hash: hash });
      console.log('Usuario actualizado:', email);
    } else {
      usuario = await Usuario.create({ nombre, email, password_hash: hash });
      console.log('Usuario creado:', email);
    }

    const secret = process.env.JWT_SECRET || 'FirmaSecretaSuperSegura123';
    const token = jwt.sign({ id: usuario.id, nombre: usuario.nombre, email: usuario.email }, secret, { expiresIn: '7d' });

    console.log('--- CREDENCIALES DE PRUEBA ---');
    console.log('email:', email);
    console.log('password:', password);
    console.log('user id:', usuario.id);
    console.log('token:', token);
    console.log('------------------------------');
    process.exit(0);
  } catch (err) {
    console.error('Error creando/actualizando usuario de prueba:', err);
    process.exit(1);
  }
})();
