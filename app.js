const express = require("express");
const session = require("express-session");
const db = require("./database/db");

const app = express();
const PORT = 3000;

// =====================================================
// CONFIGURACIÓN
// =====================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    secret: "minibus-clave-local",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false
    }
}));

// =====================================================
// MIDDLEWARES DE AUTENTICACIÓN Y ROLES
// =====================================================
function requiereLogin(req, res, next) {
    if (!req.session.usuario) {
        return res.status(401).json({ error: "Debés iniciar sesión." });
    }
    next();
}

function requiereRol(...rolesPermitidos) {
    return (req, res, next) => {
        if (!req.session.usuario) {
            return res.status(401).json({ error: "Debés iniciar sesión." });
        }
        if (!rolesPermitidos.includes(req.session.usuario.rol)) {
            return res.status(403).json({ error: "No tenés permisos para realizar esta acción." });
        }
        next();
    };
}

// =====================================================
// FUNCIONES AUXILIARES DE FECHA
// =====================================================
function obtenerFechaArgentina() {
    const ahora = new Date();
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(ahora);

    const año = partes.find(p => p.type === "year").value;
    const mes = partes.find(p => p.type === "month").value;
    const dia = partes.find(p => p.type === "day").value;

    return `${año}-${mes}-${dia}`;
}

// =====================================================
// FUNCIONES AUXILIARES DE FECHA (CALCULO DIRECTO)
// =====================================================
function obtenerMañanaArgentina() {
    const ahora = new Date();
    // Sumar 24 horas directamente para garantizar el día siguiente
    const manana = new Date(ahora.getTime() + (24 * 60 * 60 * 1000));
    
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(manana);

    const año = partes.find(p => p.type === "year").value;
    const mes = partes.find(p => p.type === "month").value;
    const dia = partes.find(p => p.type === "day").value;

    return `${año}-${mes}-${dia}`;
}

// =====================================================
// GESTIÓN DE VIAJES (CREAR, CONSULTAR, CERRAR)
// =====================================================
app.post("/viajes/crear", requiereRol("administrador", "chofer"), (req, res) => {
    const fecha = obtenerMañanaArgentina();

    db.get(
        `SELECT id, habilitado FROM viajes WHERE fecha = ?`,
        [fecha],
        (err, viajeExistente) => {
            if (err) {
                console.error("Error BD:", err);
                return res.status(500).json({ error: "Error en la base de datos al verificar viajes." });
            }

            // Si ya existe un viaje para esa fecha y está activo
            if (viajeExistente && viajeExistente.habilitado === 1) {
                return res.status(400).json({ error: `Ya existe un viaje habilitado para el día ${fecha}.` });
            }

            // Si el viaje existía pero estaba cerrado, lo reactivamos
            if (viajeExistente && viajeExistente.habilitado === 0) {
                db.run(
                    `UPDATE viajes SET habilitado = 1, cupos_ida = 25, cupos_vuelta = 25, cupos_disponibles = 25 WHERE id = ?`,
                    [viajeExistente.id],
                    function (err) {
                        if (err) {
                            console.error("Error al reactivar:", err);
                            return res.status(500).json({ error: "No se pudo reactivar el viaje." });
                        }
                        return res.json({ mensaje: `Viaje reactivado con éxito para el ${fecha}.`, id: viajeExistente.id, fecha });
                    }
                );
                return;
            }

            // Si no existe, creamos la fila en la tabla
            db.run(
                `INSERT INTO viajes (fecha, tipo, cupos_totales, cupos_disponibles, cupos_ida, cupos_vuelta, habilitado)
                 VALUES (?, 'ida_vuelta', 25, 25, 25, 25, 1)`,
                [fecha],
                function (err) {
                    if (err) {
                        console.error("Error INSERT viaje:", err);
                        return res.status(500).json({ error: "No se pudo crear el registro del viaje." });
                    }
                    res.json({ mensaje: `Viaje creado exitosamente para el ${fecha}.`, id: this.lastID, fecha });
                }
            );
        }
    );
});

// =====================================================
// AUTENTICACIÓN (LOGIN / LOGOUT / ME / REGISTRO)
// =====================================================
app.post("/login", (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return res.status(400).json({ error: "Ingresá correo y contraseña." });
    }

    db.get(
        `SELECT id, nombre, apellido, sector, dni, correo, contrasena, rol, tipo_usuario 
         FROM usuarios WHERE correo = ?`,
        [correo],
        (err, usuario) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error interno del servidor." });
            }
            if (!usuario || usuario.contrasena !== contrasena) {
                return res.status(401).json({ error: "Correo o contraseña incorrectos." });
            }

            delete usuario.contrasena;
            req.session.usuario = usuario;
            res.json(usuario);
        }
    );
});

app.get("/me", requiereLogin, (req, res) => {
    res.json(req.session.usuario);
});

app.post("/logout", requiereLogin, (req, res) => {
    req.session.destroy(() => {
        res.json({ mensaje: "Sesión cerrada." });
    });
});

app.post("/registro", (req, res) => {
    const { nombre, apellido, sector, dni, correo, contrasena, tipo_usuario } = req.body;

    if (!nombre || !apellido || !sector || !dni || !correo || !contrasena || !tipo_usuario) {
        return res.status(400).json({ error: "Completá todos los campos." });
    }

    db.get(
        `SELECT id FROM usuarios WHERE correo = ? OR dni = ?`,
        [correo, dni],
        (err, usuarioExistente) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error interno." });
            }
            if (usuarioExistente) {
                return res.status(400).json({ error: "El correo o DNI ya están registrados." });
            }

            db.run(
                `INSERT INTO usuarios (nombre, apellido, sector, dni, correo, contrasena, rol, tipo_usuario)
                 VALUES (?, ?, ?, ?, ?, ?, 'usuario', ?)`,
                [nombre, apellido, sector, dni, correo, contrasena, tipo_usuario],
                function (err) {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: "No se pudo crear el usuario." });
                    }
                    res.json({ mensaje: "Usuario creado correctamente.", id: this.lastID });
                }
            );
        }
    );
});

// =====================================================
// ADMIN - GESTIÓN DE USUARIOS
// =====================================================
app.get("/usuarios", requiereRol("administrador"), (req, res) => {
    db.all(
        `SELECT id, nombre, apellido, sector, dni, correo, rol, tipo_usuario 
         FROM usuarios ORDER BY nombre, apellido`,
        [],
        (err, usuarios) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error al obtener usuarios." });
            }
            res.json(usuarios);
        }
    );
});

app.get("/usuarios/:id", requiereRol("administrador"), (req, res) => {
    db.get(
        `SELECT id, nombre, apellido, sector, dni, correo, rol, tipo_usuario 
         FROM usuarios WHERE id = ?`,
        [req.params.id],
        (err, usuario) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error interno." });
            }
            if (!usuario) {
                return res.status(404).json({ error: "Usuario no encontrado." });
            }
            res.json(usuario);
        }
    );
});

app.put("/usuarios/:id/rol", requiereRol("administrador"), (req, res) => {
    const { id } = req.params;
    const { rol } = req.body;

    if (!['usuario', 'chofer', 'administrador'].includes(rol)) {
        return res.status(400).json({ error: "Rol no válido." });
    }

    db.run("UPDATE usuarios SET rol = ? WHERE id = ?", [rol, id], function(err) {
        if (err) {
            console.error("Error al cambiar rol:", err);
            return res.status(500).json({ error: "Error al cambiar el rol en la base de datos." });
        }
        res.json({ mensaje: "Rol actualizado correctamente." });
    });
});

app.put("/usuarios/:id", requiereRol("administrador"), (req, res) => {
    const { nombre, apellido, sector, dni, correo, rol, tipo_usuario } = req.body;

    db.run(
        `UPDATE usuarios SET nombre = ?, apellido = ?, sector = ?, dni = ?, correo = ?, rol = ?, tipo_usuario = ?
         WHERE id = ?`,
        [nombre, apellido, sector, dni, correo, rol, tipo_usuario, req.params.id],
        function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "No se pudo modificar el usuario." });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: "Usuario no encontrado." });
            }
            res.json({ mensaje: "Usuario modificado correctamente." });
        }
    );
});

app.delete("/usuarios/:id", requiereRol("administrador"), (req, res) => {
    const id = Number(req.params.id);

    if (id === req.session.usuario.id) {
        return res.status(400).json({ error: "No podés eliminar tu propio usuario." });
    }

    db.run("DELETE FROM usuarios WHERE id = ?", [id], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "No se pudo eliminar el usuario." });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Usuario no encontrado." });
        }
        res.json({ mensaje: "Usuario eliminado." });
    });
});

// =====================================================
// GESTIÓN DE VIAJES (CREAR, CONSULTAR, CERRAR)
// =====================================================
app.post("/viajes/crear", requiereRol("administrador", "chofer"), (req, res) => {
    const fecha = obtenerMañanaArgentina();

    // 1. Buscar si ya existe un viaje creado para mañana
    db.get(
        `SELECT id, habilitado FROM viajes WHERE fecha = ?`,
        [fecha],
        (err, viajeExistente) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error al consultar la base de datos." });
            }

            // Si ya existe y está habilitado
            if (viajeExistente && viajeExistente.habilitado === 1) {
                return res.status(400).json({ error: "Ya existe un viaje habilitado para la fecha de mañana." });
            }

            // Si ya existe pero estaba cerrado, lo volvemos a habilitar
            if (viajeExistente && viajeExistente.habilitado === 0) {
                db.run(
                    `UPDATE viajes SET habilitado = 1, cupos_ida = 25, cupos_vuelta = 25, cupos_disponibles = 25 WHERE id = ?`,
                    [viajeExistente.id],
                    function (err) {
                        if (err) {
                            console.error("Error reanimando viaje:", err);
                            return res.status(500).json({ error: "No se pudo reactivar el viaje." });
                        }
                        return res.json({ mensaje: "Viaje reactivado y habilitado para mañana.", id: viajeExistente.id, fecha });
                    }
                );
                return;
            }

            // Si no existe, creamos el registro nuevo
            db.run(
                `INSERT INTO viajes (fecha, tipo, cupos_totales, cupos_disponibles, cupos_ida, cupos_vuelta, habilitado)
                 VALUES (?, 'ida_vuelta', 25, 25, 25, 25, 1)`,
                [fecha],
                function (err) {
                    if (err) {
                        console.error("Error al crear viaje:", err);
                        return res.status(500).json({ error: "No se pudo crear el viaje en la base de datos." });
                    }
                    res.json({ mensaje: "Viaje creado y habilitado correctamente.", id: this.lastID, fecha });
                }
            );
        }
    );
});

app.post("/viajes", requiereRol("administrador", "chofer"), (req, res) => {
    res.redirect(307, "/viajes/crear");
});

app.get("/viajes", (req, res) => {
    const query = `
        SELECT 
            id, 
            fecha, 
            cupos_disponibles,
            cupos_ida,
            cupos_vuelta,
            habilitado,
            CASE WHEN habilitado = 1 THEN 'habilitado' ELSE 'cerrado' END AS estado
        FROM viajes 
        ORDER BY id DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Error al obtener viajes:", err);
            return res.status(500).json({ error: "Error de servidor al obtener viajes." });
        }
        res.json(rows);
    });
});

app.put("/viajes/:id/cerrar", requiereRol("administrador", "chofer"), (req, res) => {
    db.run("UPDATE viajes SET habilitado = 0 WHERE id = ?", [req.params.id], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "No se pudo cerrar el viaje." });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Viaje no encontrado." });
        }
        res.json({ mensaje: "Viaje cerrado correctamente." });
    });
});

app.delete("/viajes/:id", requiereRol("administrador", "chofer"), (req, res) => {
    db.run("UPDATE viajes SET habilitado = 0 WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: "No se pudo cerrar el viaje." });
        res.json({ mensaje: "Viaje cerrado correctamente." });
    });
});

// =====================================================
// LÓGICA Y RESERVAS DE LISTA DE ESPERA
// =====================================================
function obtenerSiguientePosicion(viajeId, direccion, callback) {
    const campoEstado = direccion === "ida" ? "ida_estado" : "vuelta_estado";
    const campoPosicion = direccion === "ida" ? "espera_ida_posicion" : "espera_vuelta_posicion";

    db.get(
        `SELECT MAX(${campoPosicion}) AS ultima FROM reservas WHERE viaje_id = ? AND ${campoEstado} = 'espera'`,
        [viajeId],
        (err, resultado) => {
            if (err) return callback(err);
            callback(null, (resultado?.ultima || 0) + 1);
        }
    );
}

function promoverSiguiente(viajeId, direccion, callback) {
    const campoEstado = direccion === "ida" ? "ida_estado" : "vuelta_estado";
    const campoPosicion = direccion === "ida" ? "espera_ida_posicion" : "espera_vuelta_posicion";
    const campoCupo = direccion === "ida" ? "cupos_ida" : "cupos_vuelta";

    db.get(
        `SELECT * FROM reservas WHERE viaje_id = ? AND ${campoEstado} = 'espera' ORDER BY ${campoPosicion} ASC LIMIT 1`,
        [viajeId],
        (err, reserva) => {
            if (err || !reserva) return callback(err);

            db.run(
                `UPDATE reservas SET ${campoEstado} = 'confirmada', ${campoPosicion} = NULL WHERE id = ?`,
                [reserva.id],
                (err) => {
                    if (err) return callback(err);

                    db.run(
                        `UPDATE viajes SET ${campoCupo} = CASE WHEN ${campoCupo} > 0 THEN ${campoCupo} - 1 ELSE 0 END WHERE id = ?`,
                        [viajeId],
                        callback
                    );
                }
            );
        }
    );
}

function crearNuevaReserva(usuarioId, viajeId, ida, vuelta, callback) {
    const fechaReserva = new Date().toISOString();
    db.run(
        `INSERT INTO reservas (usuario_id, viaje_id, ida, vuelta, ida_estado, vuelta_estado, fecha_reserva)
         VALUES (?, ?, ?, ?, 'ninguno', 'ninguno', ?)`,
        [usuarioId, viajeId, ida ? 1 : 0, vuelta ? 1 : 0, fechaReserva],
        function (err) {
            if (err) return callback(err);
            callback(null, this.lastID);
        }
    );
}

app.post("/reservas", requiereLogin, (req, res) => {
    const usuarioId = req.session.usuario.id;
    const viajeId = Number(req.body.viaje_id);
    const ida = Boolean(req.body.ida);
    const vuelta = Boolean(req.body.vuelta);

    if (!viajeId) return res.status(400).json({ error: "Debés seleccionar un viaje." });
    if (!ida && !vuelta) return res.status(400).json({ error: "Seleccioná IDA, VUELTA o ambas." });

    db.get(`SELECT * FROM viajes WHERE id = ? AND habilitado = 1`, [viajeId], (err, viaje) => {
        if (err) return res.status(500).json({ error: "Error al consultar el viaje." });
        if (!viaje) return res.status(404).json({ error: "El viaje no existe o está cerrado." });

        // Validar si el usuario ya tiene CUALQUIER reserva activa para este viaje
        db.get(
            `SELECT * FROM reservas WHERE usuario_id = ? AND viaje_id = ?`,
            [usuarioId, viajeId],
            (err, reservaExistente) => {
                if (err) return res.status(500).json({ error: "Error al consultar la reserva." });

                // Si ya existe la reserva y se intenta pedir un tramo que ya está reservado/en espera:
                if (reservaExistente) {
                    const yaTieneIda = reservaExistente.ida_estado === 'confirmada' || reservaExistente.ida_estado === 'espera';
                    const yaTieneVuelta = reservaExistente.vuelta_estado === 'confirmada' || reservaExistente.vuelta_estado === 'espera';

                    if ((ida && yaTieneIda) || (vuelta && yaTieneVuelta)) {
                        return res.status(400).json({ error: "Ya tenés una reserva activa para el/los tramo(s) seleccionado(s)." });
                    }
                }

                const procesarIda = (siguiente) => {
                    if (!ida) return siguiente();

                    if (viaje.cupos_ida > 0) {
                        if (reservaExistente) {
                            db.run(
                                `UPDATE reservas SET ida = 1, ida_estado = 'confirmada', espera_ida_posicion = NULL WHERE id = ?`,
                                [reservaExistente.id],
                                (err) => {
                                    if (err) return siguiente(err);
                                    db.run(`UPDATE viajes SET cupos_ida = cupos_ida - 1 WHERE id = ?`, [viajeId], siguiente);
                                }
                            );
                        } else {
                            crearNuevaReserva(usuarioId, viajeId, true, false, (err, idReserva) => {
                                if (err) return siguiente(err);
                                db.run(`UPDATE reservas SET ida = 1, ida_estado = 'confirmada' WHERE id = ?`, [idReserva], (err) => {
                                    if (err) return siguiente(err);
                                    db.run(`UPDATE viajes SET cupos_ida = cupos_ida - 1 WHERE id = ?`, [viajeId], siguiente);
                                });
                            });
                        }
                    } else {
                        obtenerSiguientePosicion(viajeId, "ida", (err, posicion) => {
                            if (err) return siguiente(err);
                            if (reservaExistente) {
                                db.run(
                                    `UPDATE reservas SET ida = 1, ida_estado = 'espera', espera_ida_posicion = ? WHERE id = ?`,
                                    [posicion, reservaExistente.id],
                                    siguiente
                                );
                            } else {
                                crearNuevaReserva(usuarioId, viajeId, true, false, (err, idReserva) => {
                                    if (err) return siguiente(err);
                                    db.run(
                                        `UPDATE reservas SET ida_estado = 'espera', espera_ida_posicion = ? WHERE id = ?`,
                                        [posicion, idReserva],
                                        siguiente
                                    );
                                });
                            }
                        });
                    }
                };

                const procesarVuelta = (siguiente) => {
                    if (!vuelta) return siguiente();

                    if (viaje.cupos_vuelta > 0) {
                        db.run(
                            `UPDATE reservas SET vuelta = 1, vuelta_estado = 'confirmada', espera_vuelta_posicion = NULL WHERE usuario_id = ? AND viaje_id = ?`,
                            [usuarioId, viajeId],
                            (err) => {
                                if (err) return siguiente(err);
                                db.run(`UPDATE viajes SET cupos_vuelta = cupos_vuelta - 1 WHERE id = ?`, [viajeId], siguiente);
                            }
                        );
                    } else {
                        obtenerSiguientePosicion(viajeId, "vuelta", (err, posicion) => {
                            if (err) return siguiente(err);
                            db.run(
                                `UPDATE reservas SET vuelta = 1, vuelta_estado = 'espera', espera_vuelta_posicion = ? WHERE usuario_id = ? AND viaje_id = ?`,
                                [posicion, usuarioId, viajeId],
                                siguiente
                            );
                        });
                    }
                };

                procesarIda((err) => {
                    if (err) return res.status(500).json({ error: "No se pudo procesar la IDA." });
                    procesarVuelta((err) => {
                        if (err) return res.status(500).json({ error: "No se pudo procesar la VUELTA." });
                        res.json({ mensaje: "Reserva efectuada correctamente." });
                    });
                });
            }
        );
    });
});

app.get("/mis-reservas", requiereLogin, (req, res) => {
    db.all(
        `SELECT reservas.id, reservas.viaje_id, reservas.ida, reservas.vuelta, 
                reservas.ida_estado, reservas.vuelta_estado, reservas.espera_ida_posicion, 
                reservas.espera_vuelta_posicion, reservas.fecha_reserva, viajes.fecha
         FROM reservas
         INNER JOIN viajes ON viajes.id = reservas.viaje_id
         WHERE reservas.usuario_id = ?
         ORDER BY viajes.fecha ASC`,
        [req.session.usuario.id],
        (err, reservas) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error al obtener reservas." });
            }
            res.json(reservas);
        }
    );
});

app.delete("/reservas/:id", requiereLogin, (req, res) => {
    const reservaId = Number(req.params.id);

    db.get(`SELECT * FROM reservas WHERE id = ? AND usuario_id = ?`, [reservaId, req.session.usuario.id], (err, reserva) => {
        if (err || !reserva) return res.status(404).json({ error: "Reserva no encontrada." });

        const procesarVuelta = (continuar) => {
            if (reserva.vuelta_estado === "confirmada") {
                db.run(`UPDATE viajes SET cupos_vuelta = cupos_vuelta + 1 WHERE id = ?`, [reserva.viaje_id], (err) => {
                    if (err) return continuar(err);
                    promoverSiguiente(reserva.viaje_id, "vuelta", continuar);
                });
            } else {
                continuar();
            }
        };

        const procesarIda = (continuar) => {
            if (reserva.ida_estado === "confirmada") {
                db.run(`UPDATE viajes SET cupos_ida = cupos_ida + 1 WHERE id = ?`, [reserva.viaje_id], (err) => {
                    if (err) return continuar(err);
                    promoverSiguiente(reserva.viaje_id, "ida", continuar);
                });
            } else {
                continuar();
            }
        };

        procesarIda((err) => {
            if (err) return res.status(500).json({ error: "Error cancelando IDA." });
            procesarVuelta((err) => {
                if (err) return res.status(500).json({ error: "Error cancelando VUELTA." });
                db.run(`DELETE FROM reservas WHERE id = ?`, [reservaId], (err) => {
                    if (err) return res.status(500).json({ error: "No se pudo cancelar." });
                    res.json({ mensaje: "Reserva cancelada correctamente." });
                });
            });
        });
    });
});

// =====================================================
// LISTA DE PASAJEROS (CHOFER / ADMIN)
// =====================================================
app.get("/viajes/:id/pasajeros", requiereRol("administrador", "chofer"), (req, res) => {
    const viajeId = Number(req.params.id);

    const consulta = `
        SELECT reservas.id, usuarios.id AS usuario_id, usuarios.nombre, usuarios.apellido,
               usuarios.dni, usuarios.correo, usuarios.sector, usuarios.tipo_usuario,
               reservas.ida_estado, reservas.vuelta_estado, reservas.espera_ida_posicion, reservas.espera_vuelta_posicion
        FROM reservas
        INNER JOIN usuarios ON usuarios.id = reservas.usuario_id
        WHERE reservas.viaje_id = ?
        ORDER BY usuarios.apellido, usuarios.nombre
    `;

    db.all(consulta, [viajeId], (err, reservas) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error al obtener pasajeros." });
        }

        const ida = reservas.filter(r => r.ida_estado === "confirmada");
        const vuelta = reservas.filter(r => r.vuelta_estado === "confirmada");
        const espera_ida = reservas.filter(r => r.ida_estado === "espera").sort((a, b) => a.espera_ida_posicion - b.espera_ida_posicion);
        const espera_vuelta = reservas.filter(r => r.vuelta_estado === "espera").sort((a, b) => a.espera_vuelta_posicion - b.espera_vuelta_posicion);

        res.json({ ida, vuelta, espera_ida, espera_vuelta });
    });
});

// =====================================================
// INICIO Y SERVIDOR
// =====================================================
// ✅ OPCIÓN B: En app.js
app.get("/", (req, res) => {
    if (req.session && req.session.usuario) {
        return res.sendFile(__dirname + "/public/index.html");
    }
    res.redirect("/login.html");
});

app.listen(PORT, () => {
    console.log(`Servidor funcionando en http://localhost:${PORT}`);
});