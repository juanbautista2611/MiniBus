let viajeActivoId = null;

document.addEventListener("DOMContentLoaded", () => {
    // Solo intentar cargar perfil y reservas si no estamos en el login
    if (!window.location.pathname.endsWith("login.html")) {
        cargarPerfil();
        cargarUsuario();
        cargarInicio();
        cargarMisReservas();
        cargarViajesAdmin();
    }
});
// =====================================================
// AUTENTICACIÓN (LOGIN / REGISTRO)
// =====================================================
async function iniciarSesion() {
    const correo = document.getElementById("correoLogin").value;
    const contrasena = document.getElementById("contrasenaLogin").value;
    const mensajeElem = document.getElementById("mensajeLogin");

    mensajeElem.textContent = "";

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo, contrasena })
        });

        const datos = await res.json();

        if (!res.ok) {
            mensajeElem.textContent = datos.error || "Error al iniciar sesión.";
            return;
        }

        // Redireccionar al inicio al loguearse con éxito
        window.location.href = "index.html";
    } catch (e) {
        console.error(e);
        mensajeElem.textContent = "Error de conexión con el servidor.";
    }
}

async function registrarUsuario() {
    const nombre = document.getElementById("registroNombre").value;
    const apellido = document.getElementById("registroApellido").value;
    const dni = document.getElementById("registroDni").value;
    const sector = document.getElementById("registroSector").value;
    const correo = document.getElementById("registroCorreo").value;
    const contrasena = document.getElementById("registroContrasena").value;
    const tipo_usuario = document.getElementById("registroTipoUsuario").value;
    const mensajeElem = document.getElementById("mensajeRegistro");

    mensajeElem.textContent = "";

    try {
        const res = await fetch("/registro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, apellido, dni, sector, correo, contrasena, tipo_usuario })
        });

        const datos = await res.json();

        if (!res.ok) {
            mensajeElem.className = "auth-mensaje error";
            mensajeElem.textContent = datos.error || "Error al registrar usuario.";
            return;
        }

        mensajeElem.className = "auth-mensaje";
        mensajeElem.style.color = "#2e6b3c";
        mensajeElem.textContent = "¡Cuenta creada! Ya podés ingresar.";
        
        setTimeout(() => {
            if (typeof cambiarTab === "function") cambiarTab("login");
        }, 1500);

    } catch (e) {
        console.error(e);
        mensajeElem.className = "auth-mensaje error";
        mensajeElem.textContent = "Error de conexión con el servidor.";
    }
}
// =====================================================
// PERFIL Y PANEL DE ADMINISTRACIÓN
// =====================================================
async function cargarPerfil() {
    const contenedor = document.getElementById("datosPerfil");
    if (!contenedor) return;

    try {
        const res = await fetch("/me");
        if (!res.ok) {
            window.location.href = "login.html";
            return;
        }

        const usuario = await res.json();

        contenedor.innerHTML = `
            <p><strong>Nombre y Apellido:</strong> ${usuario.nombre} ${usuario.apellido}</p>
            <p><strong>DNI:</strong> ${usuario.dni}</p>
            <p><strong>Correo:</strong> ${usuario.correo}</p>
            <p><strong>Sector:</strong> ${usuario.sector}</p>
            <p><strong>Claustro:</strong> ${usuario.tipo_usuario}</p>
            <p><strong>Rol en sistema:</strong> <span style="text-transform: capitalize; font-weight: bold; color: #2e6b3c;">${usuario.rol}</span></p>
        `;

        // Mostrar Panel de Gestión si es Administrador o Chofer
        const panelAdmin = document.getElementById("panelGestionAdmin");
        const tabUsuarios = document.getElementById("tabGestionUsuarios");

        if (panelAdmin && (usuario.rol === "administrador" || usuario.rol === "chofer")) {
            panelAdmin.style.display = "block";

            // Si es chofer pero no admin, ocultamos la pestaña de usuarios
            if (usuario.rol === "chofer" && tabUsuarios) {
                tabUsuarios.style.display = "none";
            }
        }

    } catch (e) {
        console.error("Error al cargar perfil:", e);
        contenedor.innerHTML = "<p>Error al cargar el perfil.</p>";
    }
}

// CARGAR USUARIOS EN PANEL ADMIN
async function cargarUsuariosAdmin() {
    const contenedor = document.getElementById("listaUsuariosAdmin");
    if (!contenedor) return;

    try {
        const res = await fetch("/usuarios");
        if (!res.ok) {
            contenedor.innerHTML = "<p style='color:#666;'>No tenés permisos para ver los usuarios.</p>";
            return;
        }

        const usuarios = await res.json();
        if (usuarios.length === 0) {
            contenedor.innerHTML = "<p>No hay usuarios registrados.</p>";
            return;
        }

        contenedor.innerHTML = usuarios.map(u => `
            <div style="border: 1px solid #cdd8ca; padding: 12px; border-radius: 10px; margin-bottom: 10px; background: #fdfdfd; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                    <strong>${u.nombre} ${u.apellido}</strong> (${u.correo})<br>
                    <small>DNI: ${u.dni} | Sector: ${u.sector} | Claustro: ${u.tipo_usuario}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <select onchange="cambiarRolUsuario(${u.id}, this.value)" style="padding: 6px; border-radius: 6px; font-size: 13px;">
                        <option value="usuario" ${u.rol === 'usuario' ? 'selected' : ''}>Usuario</option>
                        <option value="chofer" ${u.rol === 'chofer' ? 'selected' : ''}>Chofer</option>
                        <option value="administrador" ${u.rol === 'administrador' ? 'selected' : ''}>Administrador</option>
                    </select>
                </div>
            </div>
        `).join("");

    } catch (e) {
        console.error("Error cargando usuarios:", e);
    }
}

// Ejecutar automáticamente al cargar cualquier vista
document.addEventListener("DOMContentLoaded", () => {
    cargarPerfil();
    cargarUsuario();
    cargarInicio();
    cargarMisReservas();
    cargarViajesAdmin();
});


// =====================================================
// CARGAR INFORMACIÓN DEL USUARIO LOGUEADO
// =====================================================
async function cargarUsuario() {
    try {
        const res = await fetch("/me");
        if (!res.ok) return;
        const usuario = await res.json();

        // Actualizar el nombre en el botón del header
        const elemNombreHeader = document.getElementById("nombreHeader");
        if (elemNombreHeader) {
            elemNombreHeader.textContent = `${usuario.nombre} ${usuario.apellido}`;
        }
    } catch (e) {
        console.error("Error cargando usuario:", e);
    }
}

// =====================================================
// CARGAR EL PRÓXIMO VIAJE
// =====================================================
async function cargarInicio() {
    if (window.location.pathname.endsWith("login.html")) {
        return;
    }

    try {
        const resUsuario = await fetch("/me");
        if (!resUsuario.ok) {
            window.location.href = "login.html";
            return;
        }

        const res = await fetch("/viajes");
        if (!res.ok) return;
        const viajes = await res.json();
        
        const viajeHabilitado = viajes.find(v => v.estado === "habilitado" || v.habilitado === 1);

        const elemTitulo = document.getElementById("tituloViaje");
        const elemCuposIda = document.getElementById("cuposIda");
        const elemCuposVuelta = document.getElementById("cuposVuelta");
        const checkIda = document.getElementById("checkIda");
        const checkVuelta = document.getElementById("checkVuelta");
        const btnReserva = document.querySelector(".hero-viaje .btn-primary-custom");

        if (!viajeHabilitado) {
            if (elemTitulo) elemTitulo.textContent = "No hay viajes habilitados actualmente";
            if (elemCuposIda) elemCuposIda.textContent = "Sin cupos";
            if (elemCuposVuelta) elemCuposVuelta.textContent = "Sin cupos";
            if (btnReserva) {
                btnReserva.disabled = true;
                btnReserva.innerHTML = `<i class="bi bi-x-circle me-2"></i> No hay viajes disponibles`;
            }
            return;
        }

        viajeActivoId = viajeHabilitado.id;

        if (elemTitulo) elemTitulo.textContent = `Viaje del ${viajeHabilitado.fecha}`;
        if (elemCuposIda) elemCuposIda.textContent = `${viajeHabilitado.cupos_ida ?? 25} cupos disponibles`;
        if (elemCuposVuelta) elemCuposVuelta.textContent = `${viajeHabilitado.cupos_vuelta ?? 25} cupos disponibles`;

        // Actualizar barras de progreso visuales
        const barraIda = document.querySelector("#checkIda").closest(".card-tramo").querySelector(".progress-bar");
        const barraVuelta = document.querySelector("#checkVuelta").closest(".card-tramo").querySelector(".progress-bar");
        
        if (barraIda) barraIda.style.width = `${((viajeHabilitado.cupos_ida ?? 25) / 25) * 100}%`;
        if (barraVuelta) barraVuelta.style.width = `${((viajeHabilitado.cupos_vuelta ?? 25) / 25) * 100}%`;

        // Verificar si el usuario ya reservó para este viaje
        const resMisReservas = await fetch("/mis-reservas");
        if (resMisReservas.ok) {
            const misReservas = await resMisReservas.json();
            const reservaExistente = misReservas.find(r => r.viaje_id === viajeActivoId);

            if (reservaExistente) {
                const tieneIda = reservaExistente.ida_estado === "confirmada" || reservaExistente.ida_estado === "espera";
                const tieneVuelta = reservaExistente.vuelta_estado === "confirmada" || reservaExistente.vuelta_estado === "espera";

                if (checkIda && tieneIda) {
                    checkIda.checked = false;
                    checkIda.disabled = true;
                    if (elemCuposIda) elemCuposIda.innerHTML += " <strong>(Ya reservado)</strong>";
                }

                if (checkVuelta && tieneVuelta) {
                    checkVuelta.checked = false;
                    checkVuelta.disabled = true;
                    if (elemCuposVuelta) elemCuposVuelta.innerHTML += " <strong>(Ya reservado)</strong>";
                }

                if (tieneIda && tieneVuelta && btnReserva) {
                    btnReserva.disabled = true;
                    btnReserva.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i> Ya tenés reserva completa para este viaje`;
                    btnReserva.style.background = "#64748B";
                } else if (btnReserva) {
                    btnReserva.disabled = false;
                    btnReserva.innerHTML = `<i class="bi bi-bus-front me-2"></i> Confirmar reserva de asiento`;
                    btnReserva.style.background = "";
                }
            } else {
                if (checkIda) checkIda.disabled = false;
                if (checkVuelta) checkVuelta.disabled = false;
                if (btnReserva) {
                    btnReserva.disabled = false;
                    btnReserva.innerHTML = `<i class="bi bi-bus-front me-2"></i> Confirmar reserva de asiento`;
                    btnReserva.style.background = "";
                }
            }
        }

    } catch (e) {
        console.error("Error cargando el viaje activo:", e);
    }
}

// =====================================================
// CONFIRMAR Y GESTIONAR RESERVAS
// =====================================================
async function confirmarReserva() {
    if (!viajeActivoId) {
        alert("No hay ningún viaje disponible para reservar.");
        return;
    }

    const checkIda = document.getElementById("checkIda")?.checked ?? true;
    const checkVuelta = document.getElementById("checkVuelta")?.checked ?? true;

    try {
        const res = await fetch("/reservas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                viaje_id: viajeActivoId,
                ida: checkIda,
                vuelta: checkVuelta
            })
        });

        const resultado = await res.json();
        if (!res.ok) {
            alert(resultado.error || "No se pudo realizar la reserva.");
            return;
        }

        alert(resultado.mensaje || "¡Reserva realizada con éxito!");
        cargarInicio();
        cargarMisReservas();
    } catch (e) {
        console.error(e);
        alert("Error de conexión al reservar.");
    }
}

async function cargarMisReservas() {
    const contenedor = document.getElementById("misReservas");
    const elemTitulo = document.getElementById("tituloSeccionReservas");
    const elemSubtitulo = document.getElementById("subtituloSeccionReservas");

    if (!contenedor) return;

    try {
        const resMe = await fetch("/me");
        if (!resMe.ok) {
            contenedor.innerHTML = "<p class='p-3 text-muted'>Iniciá sesión para consultar tus reservas.</p>";
            return;
        }
        const usuarioActual = await resMe.json();

        if (!viajeActivoId) {
            const resViajes = await fetch("/viajes");
            if (resViajes.ok) {
                const viajes = await resViajes.json();
                const viajeHabilitado = viajes.find(v => v.estado === "habilitado" || v.habilitado === 1);
                if (viajeHabilitado) {
                    viajeActivoId = viajeHabilitado.id;
                }
            }
        }

        // 1. VISTA DE CHOFER O ADMINISTRADOR (Lista Completa de Pasajeros)
        if (usuarioActual.rol === "administrador" || usuarioActual.rol === "chofer") {
            if (elemTitulo) elemTitulo.innerHTML = "👥 Lista de Pasajeros (Viaje Activo)";
            if (elemSubtitulo) elemSubtitulo.textContent = "Pasajeros confirmados para el próximo viaje";

            if (!viajeActivoId) {
                contenedor.innerHTML = "<p class='p-3 text-muted'>No hay ningún viaje habilitado actualmente.</p>";
                return;
            }

            const resPasajeros = await fetch(`/viajes/${viajeActivoId}/pasajeros`);
            if (!resPasajeros.ok) {
                contenedor.innerHTML = "<p class='p-3 text-muted'>Error al obtener la lista de pasajeros.</p>";
                return;
            }

            const { ida, vuelta } = await resPasajeros.json();

            const mapaPasajeros = new Map();
            ida.forEach(p => mapaPasajeros.set(p.usuario_id, { ...p, tieneIda: true, tieneVuelta: false }));
            vuelta.forEach(p => {
                if (mapaPasajeros.has(p.usuario_id)) {
                    mapaPasajeros.get(p.usuario_id).tieneVuelta = true;
                } else {
                    mapaPasajeros.set(p.usuario_id, { ...p, tieneIda: false, tieneVuelta: true });
                }
            });

            const listaPasajeros = Array.from(mapaPasajeros.values());

            if (listaPasajeros.length === 0) {
                contenedor.innerHTML = "<p class='p-4 text-center text-muted border border-dashed rounded-4'>Aún no hay pasajeros anotados para este viaje.</p>";
                return;
            }

            contenedor.innerHTML = listaPasajeros.map(p => {
                let detalleViaje = [];
                if (p.tieneIda && p.tieneVuelta) detalleViaje.push("Ida y Vuelta");
                else if (p.tieneIda) detalleViaje.push("Solo Ida");
                else if (p.tieneVuelta) detalleViaje.push("Solo Vuelta");

                const esMiReserva = p.usuario_id === usuarioActual.id;

                return `
                    <div class="card-pasajero p-3 bg-white border rounded-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                            <strong class="d-block text-dark">${p.nombre} ${p.apellido}</strong>
                            <small class="text-muted">Sector: ${p.tipo_usuario || p.sector} | Tramo: ${detalleViaje.join("")}</small>
                            ${esMiReserva ? '<span class="badge bg-success ms-2">Tú</span>' : ''}
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge ${p.tieneIda ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-light text-muted border'} px-3 py-2">
                                ${p.tieneIda ? '☑ Ida' : '☐ Ida'}
                            </span>
                            <span class="badge ${p.tieneVuelta ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-light text-muted border'} px-3 py-2">
                                ${p.tieneVuelta ? '☑ Vuelta' : '☐ Vuelta'}
                            </span>
                            <button onclick="cancelarReserva(${p.id})" class="btn btn-outline-danger btn-sm rounded-2 ms-2">
                                Cancelar
                            </button>
                        </div>
                    </div>
                `;
            }).join("");

            return;
        }

        // 2. VISTA DE USUARIO ESTÁNDAR (Sus Propias Reservas)
        if (elemTitulo) elemTitulo.innerHTML = "📋 Mis reservas activas";
        if (elemSubtitulo) elemSubtitulo.textContent = "Gestioná tus pasajes";

        const resReservas = await fetch("/mis-reservas");
        if (!resReservas.ok) {
            contenedor.innerHTML = "<p class='p-3 text-muted'>Iniciá sesión para consultar tus reservas.</p>";
            return;
        }

        const reservas = await resReservas.json();
        if (reservas.length === 0) {
            contenedor.innerHTML = "<p class='p-4 text-center text-muted border border-dashed rounded-4'>No tenés reservas activas.</p>";
            return;
        }

        contenedor.innerHTML = reservas.map(r => `
            <div class="p-3 bg-white border rounded-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <strong class="d-block text-dark fs-6">Fecha del viaje: ${r.fecha}</strong>
                    <small class="text-muted d-block">Ida: ${r.ida_estado.toUpperCase()} ${r.espera_ida_posicion ? `(Posición #${r.espera_ida_posicion})` : ''}</small>
                    <small class="text-muted d-block">Vuelta: ${r.vuelta_estado.toUpperCase()} ${r.espera_vuelta_posicion ? `(Posición #${r.espera_vuelta_posicion})` : ''}</small>
                </div>
                <button onclick="cancelarReserva(${r.id})" class="btn btn-danger btn-sm px-3 py-2 rounded-3 fw-bold">
                    Cancelar Reserva
                </button>
            </div>
        `).join("");

    } catch (e) {
        console.error("Error cargando sección de reservas/pasajeros:", e);
    }
}

async function cancelarReserva(idReserva) {
    if (!confirm("¿Seguro que querés cancelar esta reserva?")) return;

    try {
        const res = await fetch(`/reservas/${idReserva}`, { method: "DELETE" });
        const resultado = await res.json();

        if (!res.ok) {
            alert(resultado.error || "Error al cancelar la reserva.");
            return;
        }

        alert("Reserva cancelada correctamente.");
        cargarInicio();
        cargarMisReservas();
    } catch (e) {
        console.error(e);
        alert("Error de conexión al cancelar.");
    }
}

// =====================================================
// FUNCIONES ADMIN Y PANEL DE GESTIÓN
// =====================================================
async function crearProximoViaje() {
    try {
        const res = await fetch("/viajes/crear", { 
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        const resultado = await res.json();

        if (!res.ok) {
            alert(resultado.error || "No se pudo habilitar el viaje.");
            return;
        }

        alert(resultado.mensaje || "¡Viaje creado y habilitado!");
        
        // Recargar vistas
        if (typeof cargarInicio === "function") await cargarInicio();
        if (typeof cargarViajesAdmin === "function") await cargarViajesAdmin();
        if (typeof cargarMisReservas === "function") await cargarMisReservas();

    } catch (e) {
        console.error("Error al conectar con la API:", e);
        alert("Error de conexión al intentar crear el viaje.");
    }
}

// Hacemos que la función esté disponible en el objeto global window
window.crearProximoViaje = crearProximoViaje;

async function cargarViajesAdmin() {
    const contenedor = document.getElementById("listaViajesAdmin");
    if (!contenedor) return;

    try {
        const res = await fetch("/viajes");
        if (!res.ok) return;
        const viajes = await res.json();

        if (viajes.length === 0) {
            contenedor.innerHTML = "<p style='color:#666;'>No hay viajes registrados.</p>";
            return;
        }

        contenedor.innerHTML = viajes.map(v => {
            const esHabilitado = v.estado === 'habilitado' || v.habilitado === 1;
            return `
                <div style="border: 1px solid #ccc; padding: 12px; border-radius: 8px; margin-bottom: 10px; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <strong>Fecha: ${v.fecha}</strong>
                        <span style="font-size: 11px; padding: 3px 8px; border-radius: 4px; background: ${esHabilitado ? '#2ecc71' : '#e74c3c'}; color: white; font-weight: bold;">
                            ${esHabilitado ? 'HABILITADO' : 'CERRADO'}
                        </span>
                    </div>
                    ${esHabilitado ? `
                        <button onclick="cerrarViaje(${v.id})" style="background: #b94c42; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                            Cerrar Viaje
                        </button>
                    ` : '<small style="color:#888;">Este viaje fue cerrado.</small>'}
                </div>
            `;
        }).join("");
    } catch (e) {
        console.error("Error cargando panel de viajes:", e);
    }
}

async function cerrarViaje(idViaje) {
    if (!confirm("¿Deseas cerrar este viaje?")) return;

    try {
        const res = await fetch(`/viajes/${idViaje}/cerrar`, { method: "PUT" });
        const resultado = await res.json();

        if (!res.ok) {
            alert(resultado.error || "No se pudo cerrar el viaje.");
            return;
        }

        alert("Viaje cerrado correctamente.");
        cargarInicio();
        cargarViajesAdmin();
    } catch (e) {
        console.error(e);
        alert("Error de conexión al cerrar el viaje.");
    }
}

const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database/datos.db");

db.serialize(() => {
    // 1. Eliminar todas las reservas asociadas a los viajes
    db.run("DELETE FROM reservas", (err) => {
        if (err) {
            console.error("Error al eliminar reservas:", err.message);
        } else {
            console.log("✔ Reservas eliminadas correctamente.");
        }
    });

    // 2. Eliminar todos los viajes registrados
    db.run("DELETE FROM viajes", (err) => {
        if (err) {
            console.error("Error al eliminar viajes:", err.message);
        } else {
            console.log("✔ Todos los viajes han sido eliminados correctamente.");
        }
    });
});

db.close();