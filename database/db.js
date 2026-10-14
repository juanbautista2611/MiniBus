const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database/datos.db", (err) => {
    if (err) {
        console.error("Error al abrir la base de datos:", err);
    } else {
        console.log("Base de datos conectada.");
    }
});

db.serialize(() => {

    // =========================
    // USUARIOS
    // =========================
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            apellido TEXT DEFAULT '',
            sector TEXT DEFAULT '',
            dni TEXT NOT NULL,
            correo TEXT NOT NULL,
            contrasena TEXT NOT NULL,
            rol TEXT NOT NULL DEFAULT 'usuario',
            tipo_usuario TEXT NOT NULL DEFAULT 'no_docente'
        )
    `);

    // =========================
    // VIAJES
    // =========================
    db.run(`
        CREATE TABLE IF NOT EXISTS viajes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'ida_vuelta',
            cupos_totales INTEGER NOT NULL DEFAULT 25,
            cupos_disponibles INTEGER NOT NULL DEFAULT 25,
            habilitado INTEGER NOT NULL DEFAULT 0,
            cupos_ida INTEGER NOT NULL DEFAULT 25,
            cupos_vuelta INTEGER NOT NULL DEFAULT 25
        )
    `);

    // =========================
    // RESERVAS
    // =========================
    db.run(`
        CREATE TABLE IF NOT EXISTS reservas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            viaje_id INTEGER NOT NULL,
            ida INTEGER NOT NULL DEFAULT 0,
            vuelta INTEGER NOT NULL DEFAULT 0,
            ida_estado TEXT NOT NULL DEFAULT 'ninguno',
            vuelta_estado TEXT NOT NULL DEFAULT 'ninguno',
            espera_ida_posicion INTEGER,
            espera_vuelta_posicion INTEGER,
            fecha_reserva TEXT NOT NULL,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
            FOREIGN KEY (viaje_id) REFERENCES viajes(id),
            UNIQUE(usuario_id, viaje_id)
        )
    `);

    // =========================
    // MIGRACIONES
    // =========================
    db.all("PRAGMA table_info(usuarios)", (err, columnas) => {
        if (err) {
            console.error("Error leyendo tabla usuarios:", err);
            return;
        }
        const nombres = columnas.map(columna => columna.name);

        if (!nombres.includes("apellido")) {
            db.run("ALTER TABLE usuarios ADD COLUMN apellido TEXT DEFAULT ''");
        }
        if (!nombres.includes("sector")) {
            db.run("ALTER TABLE usuarios ADD COLUMN sector TEXT DEFAULT ''");
        }
        if (!nombres.includes("rol")) {
            db.run("ALTER TABLE usuarios ADD COLUMN rol TEXT NOT NULL DEFAULT 'usuario'");
        }
        if (!nombres.includes("tipo_usuario")) {
            db.run("ALTER TABLE usuarios ADD COLUMN tipo_usuario TEXT NOT NULL DEFAULT 'no_docente'");
        }
    });

    db.all("PRAGMA table_info(viajes)", (err, columnas) => {
        if (err) {
            console.error("Error leyendo tabla viajes:", err);
            return;
        }
        const nombres = columnas.map(columna => columna.name);

        if (!nombres.includes("tipo")) {
            db.run("ALTER TABLE viajes ADD COLUMN tipo TEXT NOT NULL DEFAULT 'ida_vuelta'");
        }
        if (!nombres.includes("cupos_totales")) {
            db.run("ALTER TABLE viajes ADD COLUMN cupos_totales INTEGER NOT NULL DEFAULT 25");
        }
        if (!nombres.includes("cupos_disponibles")) {
            db.run("ALTER TABLE viajes ADD COLUMN cupos_disponibles INTEGER NOT NULL DEFAULT 25");
        }
        if (!nombres.includes("habilitado")) {
            db.run("ALTER TABLE viajes ADD COLUMN habilitado INTEGER NOT NULL DEFAULT 0");
        }
        if (!nombres.includes("cupos_ida")) {
            db.run("ALTER TABLE viajes ADD COLUMN cupos_ida INTEGER NOT NULL DEFAULT 25");
        }
        if (!nombres.includes("cupos_vuelta")) {
            db.run("ALTER TABLE viajes ADD COLUMN cupos_vuelta INTEGER NOT NULL DEFAULT 25");
        }
    });

});



module.exports = db;