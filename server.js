const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a MongoDB Atlas
const uri = "mongodb+srv://angel:QVrnhO1SAnyCWOX9@serverlessinstance0.jpasihl.mongodb.net/?retryWrites=true&w=majority&appName=ServerlessInstance0";
const client = new MongoClient(uri);

const dbName = "bimu";
const usersCollection = "user";
const routesCollection = "route";
const outingsCollection = "outing";

// === USER ENDPOINTS ===

// Registrar usuario
app.post('/registerUser', async (req, res) => {
  try {
    const user = req.body;
    // Chequeo de existencia por email
    const exists = await client.db(dbName).collection(usersCollection)
      .findOne({ email: user.email });
    if (exists) return res.status(400).json({ error: "User already exists" });
    // OJO: la contraseña se guarda tal cual, para TFG está bien (pero en producción deberías hacer hash).
    const result = await client.db(dbName).collection(usersCollection).insertOne(user);
    res.json({ ...user, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar usuario por _id
app.put('/editUser/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const result = await client.db(dbName).collection(usersCollection)
      .findOneAndUpdate({ _id: new ObjectId(id) }, { $set: fields }, { returnDocument: "after" });
    res.json(result.value);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrar usuario por _id
app.delete('/deleteUser/:id', async (req, res) => {
  try {
    await client.db(dbName).collection(usersCollection).deleteOne({ _id: new ObjectId(req.params.id) });
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar usuarios por username
app.get('/findUserByUsername/:username', async (req, res) => {
  try {
    const users = await client.db(dbName).collection(usersCollection)
      .find({ username: req.params.username }).toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener usuario por _id
app.get('/getUser/:id', async (req, res) => {
  try {
    const user = await client.db(dbName).collection(usersCollection)
      .findOne({ _id: new ObjectId(req.params.id) });
    if (user) res.json(user);
    else res.status(404).json({ error: "User not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LOGIN POR EMAIL Y PASSWORD ---
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await client.db(dbName).collection(usersCollection)
      .findOne({ email, password });
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === ROUTE ENDPOINTS ===

// Añadir ruta
app.post('/addRoute', async (req, res) => {
  try {
    const route = req.body;
    const result = await client.db(dbName).collection(routesCollection).insertOne(route);
    res.json({ ...route, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar ruta por _id
app.put('/editRoute/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const fields = req.body;
    const result = await client.db(dbName).collection(routesCollection)
      .findOneAndUpdate({ _id: new ObjectId(routeId) }, { $set: fields }, { returnDocument: "after" });
    res.json(result.value);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrar ruta por _id
app.delete('/deleteRoute/:routeId', async (req, res) => {
  try {
    await client.db(dbName).collection(routesCollection).deleteOne({ _id: new ObjectId(req.params.routeId) });
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar rutas por parámetros
app.post('/searchRoutes', async (req, res) => {
  try {
    const params = req.body;
    let query = {};
    if (params.difficulty !== undefined && params.difficulty !== null)
      query.difficulty = params.difficulty;
    if (params.location) {
      // Para búsqueda exacta; para cercanía haría falta lógica geoespacial.
      query['locationStart.latitude'] = params.location.latitude;
      query['locationStart.longitude'] = params.location.longitude;
    }
    if (params.fromDate || params.toDate) {
      query.timeStart = {};
      if (params.fromDate) query.timeStart.$gte = params.fromDate;
      if (params.toDate) query.timeStart.$lte = params.toDate;
    }
    const routes = await client.db(dbName).collection(routesCollection).find(query).toArray();
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === OUTING ENDPOINTS ===

// Añadir Outing
app.post('/addOuting', async (req, res) => {
  try {
    const outing = req.body;
    const result = await client.db(dbName).collection(outingsCollection).insertOne(outing);
    res.json({ ...outing, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrar Outing por _id
app.delete('/deleteOuting/:outingId', async (req, res) => {
  try {
    await client.db(dbName).collection(outingsCollection).deleteOne({ _id: new ObjectId(req.params.outingId) });
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar Outings por userId
app.get('/findOutingsByUser/:userId', async (req, res) => {
  try {
    const outings = await client.db(dbName).collection(outingsCollection)
      .find({ userId: req.params.userId }).toArray();
    res.json(outings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar Outings por routeId
app.get('/findOutingsByRoute/:routeId', async (req, res) => {
  try {
    const outings = await client.db(dbName).collection(outingsCollection)
      .find({ routeId: req.params.routeId }).toArray();
    res.json(outings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Puerto
const PORT = process.env.PORT || 3000;
client.connect().then(() => {
  app.listen(PORT, () => {
    console.log('Servidor Express escuchando en puerto', PORT);
  });
}).catch(console.error);
