const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database/datos.db");

const correo = "juanromiti2014@gmail.com";


db.run(
    `UPDATE usuarios
     SET rol = 'administrador'
     WHERE correo = ?`,
    [correo],
    function (err) {

        if (err) {

            console.error(
                "Error:",
                err.message
            );

            return;

        }


        if (this.changes === 0) {

            console.log(
                "No se encontró ningún usuario con ese correo."
            );

        } else {

            console.log(
                "Usuario convertido en administrador correctamente."
            );

        }


        db.close();

    }
);