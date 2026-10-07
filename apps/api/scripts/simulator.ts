import axios from 'axios';
import { fakerES as faker } from '@faker-js/faker';

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api';

async function runSimulation() {
  console.log('🚀 Iniciando Simulación de Datos (Parapente School)...');
  console.log(`🌐 Usando API en: ${API_URL}`);

  try {
    // 0. Autenticación
    console.log('\n🔑 0. Iniciando sesión con admin...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@parapente.com',
      password: 'admin123'
    });
    const token = loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
    console.log('✅ Autenticación exitosa.');

    // 1. Crear Piloto
    console.log('\n👨‍✈️ 1. Creando un Piloto (Instructor)...');
    const pilotoData = {
      nombre: faker.person.fullName(),
      email: faker.internet.email(),
      telefono: faker.phone.number(),
      peso: faker.number.int({ min: 65, max: 90 }),
      tieneLicencia: true,
      prioridad: faker.number.int({ min: 1, max: 5 }),
    };
    
    const resPiloto = await axios.post(`${API_URL}/pilotos`, pilotoData, authHeaders);
    const piloto = resPiloto.data;
    console.log(`✅ Piloto creado: ${piloto.nombre} (ID: ${piloto.id})`);

    // 2. Crear Reserva y Pasajero (Alumno)
    console.log('\n📝 2. Creando una Reserva y Pasajero...');
    const reservaData = {
      nombreTitular: faker.person.fullName(),
      email: faker.internet.email(),
      telefono: faker.phone.number(),
      estadoPago: 'ABONADO',
      valorTotal: 100000,
      abono: 50000,
      fechaReserva: faker.date.soon().toISOString(),
      pasajeros: [
        {
          nombre: faker.person.fullName(),
          peso: faker.number.int({ min: 50, max: 100 }),
          rutDni: faker.string.numeric(8) + '-' + faker.string.numeric(1),
          condicionFisica: 'Normal',
          firmaDeslinde: true
        }
      ]
    };

    const resReserva = await axios.post(`${API_URL}/reservas`, reservaData, authHeaders);
    const reserva = resReserva.data;
    console.log(`✅ Reserva creada: ${reserva.nombreTitular} (ID: ${reserva.id}, Número: ${reserva.numeroReserva})`);
    
    const pasajero = reserva.pasajeros[0];
    console.log(`✅ Pasajero asignado: ${pasajero.nombre} (ID: ${pasajero.id}, Peso: ${pasajero.peso}kg)`);

    console.log('\n🪂 3. Registrando un Vuelo (Asignando piloto a pasajero)...');
    
    console.log('   - Obteniendo configuración de bloques...');
    const resBloques = await axios.get(`${API_URL}/configuracion-bloques`, authHeaders);
    const configuraciones = resBloques.data;
    
    let horaBloque = '09:00'; // Fallback
    if (configuraciones.length > 0) {
      const configBase = configuraciones.find((c: any) => !c.fechaExacta) || configuraciones[0];
      if (configBase && configBase.horarios && configBase.horarios.length > 0) {
        const randomBloque = configBase.horarios[Math.floor(Math.random() * configBase.horarios.length)];
        horaBloque = randomBloque.horaInicio;
      }
    }

    // Schedule for tomorrow at the valid block time
    const fechaHora = new Date();
    fechaHora.setDate(fechaHora.getDate() + 1);
    const [horas, minutos] = horaBloque.split(':');
    fechaHora.setHours(parseInt(horas, 10), parseInt(minutos, 10), 0, 0);

    const vueloData = {
      fechaHora: fechaHora.toISOString(),
      valorPactado: 50000,
      estado: 'AGENDADO',
      pilotoId: piloto.id,
      pasajeroId: pasajero.id
    };

    const resVuelo = await axios.post(`${API_URL}/vuelos`, vueloData, authHeaders);
    const vuelo = resVuelo.data;
    console.log(`✅ Vuelo registrado exitosamente (ID: ${vuelo.id})`);
    console.log(`   - Piloto ID: ${vuelo.pilotoId}`);
    console.log(`   - Pasajero ID: ${vuelo.pasajeroId}`);
    console.log(`   - Fecha: ${new Date(vuelo.fechaHora).toLocaleString()}`);
    console.log(`   - Estado: ${vuelo.estado}`);

    console.log('\n🎉 Simulación completada con éxito.');

  } catch (error: any) {
    console.error('\n❌ Error durante la simulación:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

runSimulation();
