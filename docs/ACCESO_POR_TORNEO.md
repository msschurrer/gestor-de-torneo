# Acceso vigente: sin cuentas, con enlaces por torneo

Cualquier persona puede ver los torneos públicos publicados y crear uno nuevo sin registrarse. El creador conserva un secreto aleatorio de 256 bits en este navegador. El enlace privado permite recuperar el acceso en otro dispositivo. Se transmite en el fragmento de la URL y se retira de la barra tras guardarse localmente; las operaciones posteriores usan un encabezado privado. No se usa correo, contraseña ni SMTP.

En Accesos, el creador ve su enlace y genera un enlace diferente por colaborador. El enlace de colaborador permite editar la información deportiva del torneo pero no cambiar privacidad ni gestionar accesos. El creador puede revocar cada enlace. Cualquier persona que tenga un enlace puede ejercer esos permisos; no permite comprobar la identidad personal. Hay que guardar el enlace de creador fuera del navegador. Sin el enlace, borrar los datos del navegador implica perder el acceso.

El servidor almacena únicamente hashes SHA-256 de los secretos en un esquema privado sin permisos directos sobre las tablas. Los RPC validan el secreto para cada torneo, incluida la carga de borradores y privados. Las operaciones de permisos se serializan con las modificaciones deportivas y mantienen control de versión. El creador por enlace no se atribuye a un usuario antiguo. Los torneos existentes no pueden reclamarse con un ID público ni por conocer su nombre.

Los permisos y cuentas históricos se conservan para una migración futura, pero no hay pantallas de cuentas en el flujo actual. Los enlaces pueden reenviarse; una revocación invalida todas las copias de ese enlace. El enlace completo de un colaborador solo se muestra al crearlo. Si se pierde, el creador puede revocarlo y emitir uno nuevo.

Pruebas: tests/links.sql usa secretos ficticios y rollback para comprobar creación, recuperación, edición, separación entre torneos, privacidad, prohibición de delegar, revocación y versiones. tests/database.sql conserva la cobertura del modelo anterior y de la proyección pública. La app valida fixtures y resultados antes de guardarlos. Los secretos nunca se incluyen en el documento deportivo ni en la respuesta pública.
