---
title: "Identidad y acceso"
description: "Roles a medida, inicio de sesión con LDAP, Active Directory y SAML, y aprovisionamiento SCIM, todo incluido en cada Cascade sin ningún plan de pago."
---

Quién entra y qué puede hacer una vez dentro. Cascade entrega todo esto a todo el mundo. Nada de esto es de pago y no hay ninguna comprobación de licencia detrás.

Todos los endpoints de abajo están en el documento OpenAPI de `/api/v1/openapi.json`, y cada uno tiene una prueba que lo llama.

## Roles a medida

En el editor: Ajustes, Roles. Todos leen los roles; un propietario o administrador crea, cambia y borra los roles a medida, y se los asigna a las personas de un proyecto desde la misma pantalla.

Un proyecto trae cuatro roles integrados: admin, editor, operator y viewer. Viven en el código y nunca cambian. Cuando ninguno tiene el tamaño justo, cree un rol a medida: un nombre y una lista de permisos del proyecto.

Un jefe de línea que puede iniciar los flujos de trabajo de la línea y leer sus ejecuciones, pero no puede editar nada, es el motivo más habitual:

```sh
curl -X POST $CASCADE/api/v1/roles -H "Authorization: Bearer $KEY" \
  -d '{"name":"line-lead","description":"runs the line","permissions":["project.read","workflow.read","workflow.execute","execution.read"]}'
```

Después ponga a alguien en un proyecto con ese rol, con la misma llamada que para un rol integrado:

```sh
curl -X PUT $CASCADE/api/v1/projects/$PROJECT/members/$USER -d '{"role":"line-lead"}'
```

Qué conviene saber:

- `GET /api/v1/permissions` lista todos los permisos que puede llevar un rol, y `GET /api/v1/roles` lista los cuatro roles integrados y los roles a medida con lo que puede hacer cada uno. Cualquier persona con sesión iniciada puede leer ambos, porque un administrador de proyecto los necesita para elegir un rol.
- Crear, cambiar y borrar un rol a medida es cosa de un propietario o administrador de la instancia, el permiso `role.manage`. Un administrador de proyecto puede dar un rol a las personas de su proyecto, pero no puede escribir uno nuevo, así que nadie se concede más de lo que le dieron.
- Un rol lleva solo permisos de proyecto. No puede llevar `user.manage`, `audit.read` ni ningún otro permiso de la instancia, y pedir uno da un 400.
- Un nombre tiene de 2 a 40 letras minúsculas, dígitos y guiones, y empieza por una letra. No se puede cambiar después, porque los miembros y las cuentas de servicio tienen un rol por su nombre. Los cuatro nombres integrados están ocupados.
- Cambiar los permisos de un rol llega a todos los que lo tienen en su siguiente petición. No hay nada en caché, así que no existe una ventana en la que un permiso retirado siga funcionando.
- Una clave de cuenta de servicio puede tener un rol a medida como rol de proyecto, y los ámbitos de una clave de API lo siguen recortando.
- Borrar un rol que alguien tiene se rechaza con un 409, que indica cuántos miembros y claves de cuenta de servicio lo tienen. Muévalos primero.
- Los cambios de rol están en el registro de auditoría como `role.created`, `role.updated` (con los permisos de antes y de después) y `role.deleted`.

## LDAP y Active Directory

Las personas inician sesión con el nombre y la contraseña que ya tienen en la planta: OpenLDAP, 389 Directory Server, FreeIPA o Active Directory. Convive con las cuentas locales y con OIDC, y está apagado hasta que usted define `HOTLOOP_CASCADE_LDAP_URL`.

Así transcurre un inicio de sesión:

1. Una cuenta de servicio (o una búsqueda anónima, si su directorio la permite) encuentra a la persona con el filtro de usuario.
2. Busca los grupos a los que pertenece.
3. El propio directorio comprueba la contraseña, haciendo bind como la persona. Cascade nunca guarda esa contraseña y nunca ve un hash de ella. La cuenta que se crea aquí no tiene contraseña propia, así que la contraseña del directorio no sirve en `/login` como si fuera local.
4. La cuenta se crea en el primer inicio de sesión (a menos que lo desactive), y su rol sigue a sus grupos en cada inicio de sesión posterior.

La página de inicio de sesión muestra un segundo formulario cuando está activado, y lo mismo es una sola llamada, `POST /auth/ldap/login` con `{"username": "...", "password": "..."}`. Un nombre incorrecto y una contraseña incorrecta reciben la misma respuesta. Una contraseña vacía nunca llega al directorio, porque la mayoría de los directorios responden con éxito a un bind con contraseña vacía.

### Ajustes

Todos son variables de entorno. Con el chart de Helm, póngalas en `env`, y la contraseña del bind en `extraEnv` desde un secreto.

| Variable | Qué hace |
|---|---|
| `HOTLOOP_CASCADE_LDAP_URL` | `ldap://host:389` o `ldaps://host:636`. Lo activa. |
| `HOTLOOP_CASCADE_LDAP_FLAVOR` | `ldap` (predeterminado) o `ad`. Solo elige los valores predeterminados de más abajo. |
| `HOTLOOP_CASCADE_LDAP_START_TLS` | `true` mejora una conexión `ldap://` antes de enviar nada. |
| `HOTLOOP_CASCADE_LDAP_CA_FILE` | Archivo PEM con las autoridades en las que confiar para el certificado del directorio. Vacío significa las del sistema. |
| `HOTLOOP_CASCADE_LDAP_TLS_SERVER_NAME` | El nombre para el que debe ser el certificado, cuando no es el host de la URL. |
| `HOTLOOP_CASCADE_LDAP_BIND_DN` | La cuenta de servicio que busca a las personas. Vacío es una búsqueda anónima. |
| `HOTLOOP_CASCADE_LDAP_BIND_PASSWORD` o `_FILE` | Su contraseña, o un archivo que la contiene. No ambas. Un DN sin contraseña se rechaza, porque sería un bind anónimo. |
| `HOTLOOP_CASCADE_LDAP_USER_BASE` | Obligatorio. El DN bajo el que se busca a las personas. |
| `HOTLOOP_CASCADE_LDAP_USER_FILTER` | Encuentra a una persona. `{username}` es lo que escribió, con los caracteres especiales escapados. |
| `HOTLOOP_CASCADE_LDAP_GROUP_BASE` | El DN bajo el que se buscan los grupos. Vacío significa que no se buscan grupos. |
| `HOTLOOP_CASCADE_LDAP_GROUP_FILTER` | Encuentra los grupos a los que pertenece una persona. `{dn}` es su DN y `{username}` lo que escribió. |
| `HOTLOOP_CASCADE_LDAP_ID_ATTR`, `_EMAIL_ATTR`, `_NAME_ATTR` | Los atributos del id estable, del correo electrónico y del nombre para mostrar. |
| `HOTLOOP_CASCADE_LDAP_ROLES` | Pares `group=role`, separados por comas: `supervisors=admin, operators=member`. Un grupo se nombra por su `cn` o por su DN completo. Gana el rol más poderoso entre los grupos de una persona. |
| `HOTLOOP_CASCADE_LDAP_DEFAULT_ROLE` | `member`, `admin` o `none`. Con una asignación de roles el valor predeterminado es `none`, así que quien no está en ningún grupo asignado se rechaza. |
| `HOTLOOP_CASCADE_LDAP_JIT` | `false` hace las cuentas solo a mano. Predeterminado `true`. |
| `HOTLOOP_CASCADE_LDAP_NAME` | Cómo lo llama el botón de inicio de sesión. |

Los valores predeterminados de `ldap`: filtro de usuario `(&(objectClass=inetOrgPerson)(uid={username}))`, filtro de grupo `(&(|(objectClass=groupOfNames)(objectClass=groupOfUniqueNames)(objectClass=group))(member={dn}))`, id `entryUUID`, correo `mail`, nombre `cn`.

Los valores predeterminados de `ad`: un usuario se encuentra por `sAMAccountName` o por nombre principal de usuario, así que `alice` y `alice@plant.example` funcionan los dos, y una cuenta deshabilitada se deja fuera de la búsqueda. Los grupos usan la regla de pertenencia anidada (`member:1.2.840.113556.1.4.1941:={dn}`), así que quien está en un grupo que está dentro de un grupo asignado también recibe el rol. El id es `objectGUID`, escrito como GUID, correo `mail`, nombre `displayName`.

### Qué conviene saber

- **Active Directory exige cifrado.** Rechaza un bind simple en una conexión sin cifrar. Use `ldaps://`, o `ldap://` con `START_TLS=true`. Cascade comprueba el certificado contra el archivo de CA (o las raíces del sistema) y contra el nombre del servidor, y no existe ningún ajuste que se salte la comprobación. Un directorio que firma su propio certificado necesita su CA en `CA_FILE`.
- **La cuenta está ligada al id del directorio, no al nombre.** Si renombra a alguien en el directorio, o lo mueve a otra OU, sigue siendo la misma cuenta aquí. A alguien sin `mail` no se le puede crear una cuenta (el inicio de sesión lo dice).
- **El directorio es la autoridad para la dirección.** Una cuenta que ya existe aquí con el mismo correo se vincula a la entrada del directorio la primera vez que esa persona inicia sesión, sin verificación adicional, igual que una dirección OIDC verificada. No apunte esto a un directorio que no administre usted.
- **La primera cuenta que recibe una instancia es su propietaria**, se cree como se cree. Cree primero al propietario con la configuración inicial.
- **Un segundo factor configurado aquí sigue contando.** Una contraseña del directorio es un factor. A quien tiene una app de autenticación o una passkey en su cuenta se le pide después, y la exigencia de MFA de toda la instancia se aplica como a todos los demás.
- **Las contraseñas incorrectas también bloquean la cuenta aquí.** Cinco seguidas en una cuenta que ya está ligada al directorio la bloquean durante un minuto, que se duplica, igual que una local, antes de que haga falta el bloqueo del propio directorio. Una persona que el directorio no conoce, una contraseña incorrecta y una cuenta bloqueada quedan en el registro de auditoría como `auth.login_failed` o `auth.login_refused`, y una persona que el directorio dejó pasar y que Cascade rechazó (sin grupo, sin correo, JIT desactivado) es `auth.sso_refused`.
- **Un directorio caído es un error del servidor, no una contraseña incorrecta.** El inicio de sesión dice que el directorio no respondió, y el detalle queda en el registro.
- Cada llamada al directorio se limita a quince segundos, y solo una persona puede coincidir con el filtro de usuario: dos coincidencias son un rechazo que nombra el problema, nunca la primera.

## SAML

Inicio de sesión único con cualquier proveedor de identidad SAML 2.0. Cascade es el proveedor de servicio. Convive con las cuentas locales, OIDC y LDAP, y está apagado hasta que usted indica los metadatos del proveedor.

Los pasos:

1. Cascade publica sus propios metadatos en `/auth/saml/metadata`. Entrégueselos al proveedor, o introduzca los dos valores que contienen: el id de entidad y el assertion consumer service, `<public url>/auth/saml/acs`, con binding HTTP-POST.
2. Defina `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` con la dirección de metadatos del proveedor (algo como `https://sso.plant.example/saml/metadata`), o `HOTLOOP_CASCADE_SAML_IDP_METADATA_FILE` con el mismo documento guardado en disco.
3. La página de inicio de sesión muestra un botón "Iniciar sesión con". Va a `/auth/saml/start`.

Qué comprueba a la vuelta: la firma de la respuesta contra el certificado del proveedor que está en sus metadatos, la audiencia, la ventana de tiempo, que responde a una petición que inició este navegador y que el inicio de sesión se inició en este navegador. Una respuesta que nadie pidió (un inicio de sesión iniciado en el proveedor) se rechaza. El estado de cada inicio de sesión sirve una sola vez, así que una respuesta capturada no se puede reproducir.

| Variable | Qué hace |
|---|---|
| `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` o `_FILE` | Los metadatos del proveedor. Uno de los dos activa SAML; no ambos. |
| `HOTLOOP_CASCADE_SAML_ENTITY_ID` | Cómo se presenta esta instancia al proveedor. Predeterminado: su URL de metadatos. |
| `HOTLOOP_CASCADE_SAML_KEY_FILE` y `_CERT_FILE` | El par de claves de esta instancia, PEM, RSA o EC. Ambos o ninguno. Predeterminado: un par creado en el primer arranque como `saml-sp.key` y `saml-sp.crt` en el directorio de datos, y conservado. |
| `HOTLOOP_CASCADE_SAML_SIGN_REQUESTS` | `true` firma cada petición que envía Cascade. Hay que comunicar el certificado al proveedor. Predeterminado `false`. |
| `HOTLOOP_CASCADE_SAML_NAMEID_FORMAT` | Con qué le pide Cascade al proveedor que identifique a las personas: `persistent` (predeterminado), `email` o `unspecified`. |
| `HOTLOOP_CASCADE_SAML_SUBJECT_ATTR` | Un atributo que identifica a la persona en lugar del NameID. |
| `HOTLOOP_CASCADE_SAML_EMAIL_ATTR`, `_NAME_ATTR`, `_GROUPS_ATTR` | Qué atributos contienen el correo, el nombre para mostrar y los grupos. |
| `HOTLOOP_CASCADE_SAML_ROLES`, `_DEFAULT_ROLE`, `_JIT`, `_NAME` | Lo mismo que en LDAP: los pares de grupo a rol, el rol para quien no está en ninguno, si se crea una cuenta en el primer inicio de sesión y el nombre del botón. |

Sin los ajustes de atributos, Cascade busca los nombres habituales. El correo es `email`, `mail`, `emailAddress`, el id de objeto LDAP `urn:oid:0.9.2342.19200300.100.1.3` o el URI de claim `.../claims/emailaddress`, y recurre al NameID cuando es una dirección. El nombre es `displayName`, `name`, o el nombre y el apellido. Los grupos son `groups`, `group`, `memberOf`, el URI `.../claims/Group` y el claim de grupos de Microsoft.

Qué conviene saber:

- **Pida un id persistente.** Una cuenta está ligada al NameID, y uno transitorio es distinto en cada inicio de sesión. Cascade pide uno persistente y rechaza uno transitorio con un mensaje que lo dice, en lugar de crear una cuenta nueva en cada inicio de sesión. Si su proveedor solo puede enviar un id transitorio, indique en `SUBJECT_ATTR` un atributo que sea estable.
- **El proveedor es la autoridad para la dirección.** Igual que con LDAP, una cuenta existente con el mismo correo se vincula en el primer inicio de sesión SAML.
- **Detrás de un proxy, defina `HOTLOOP_CASCADE_PUBLIC_URL` con la dirección que usa la gente.** El proveedor envía su POST a la URL del assertion consumer construida a partir de ella.
- **Use HTTPS.** El proveedor responde con un POST desde otro sitio, así que la cookie que liga un inicio de sesión a su navegador tiene que enviarse entre sitios, y los navegadores solo lo permiten en una conexión segura.
- **Más de un pod** necesita el mismo par de claves en todos: póngalo en un secreto e indíquelo con `KEY_FILE` y `CERT_FILE`, o cada pod crea el suyo.
- Un segundo factor configurado aquí sigue contando tras un inicio de sesión SAML, y SAML nunca hace que cuente el multifactor propio del proveedor.
- El cierre de sesión único no se admite. Cerrar sesión termina la sesión aquí.

## SCIM

En el editor: Ajustes, Inicio de sesión y SCIM muestra si SCIM está activado, la URL base que hay que dar al proveedor y los tokens, con un botón para crear uno (se muestra una sola vez) y para revocar otro. LDAP, SAML y OpenID Connect se definen en el entorno de la instancia cuando arranca, así que la misma pantalla muestra cuáles están activos y adónde apunta un proveedor (las URL de metadatos y de ACS de SAML), y no finge cambiarlos.

SCIM es la manera en que un proveedor de identidad mantiene las cuentas al día con su directorio: crea a una persona cuando entra, la cambia cuando se mueve, la desactiva cuando se va y mantiene los grupos. Cascade es el servidor SCIM (RFC 7643 y 7644, versión 2.0), y el proveedor es el cliente. Está construido según lo que dicen los RFC y lo que envían los proveedores de identidad habituales, y se prueba en cada versión con scim2-tester, un cliente SCIM de otro equipo que ejecuta todas las comprobaciones que tiene. Está apagado hasta que usted define `HOTLOOP_CASCADE_SCIM=true`.

Cómo configurarlo:

1. Actívelo con `HOTLOOP_CASCADE_SCIM=true` y reinicie.
2. Cree un token para el proveedor, como propietario o administrador de la instancia: `POST /api/v1/scim-tokens` con `{"name": "plant directory"}`. El `secret` de la respuesta (empieza por `hlcs_`) se muestra una sola vez, así que póngalo en el proveedor enseguida. `GET /api/v1/scim-tokens` los lista con el momento de último uso de cada uno, y `DELETE /api/v1/scim-tokens/{token}` revoca uno. Hay que tener la sesión iniciada para crear un token: una clave de API no puede, así que una clave filtrada no puede crear más.
3. Dele al proveedor la URL base, `<public url>/scim/v2`, y el token como bearer token.

Cada llamada necesita el token, y cada respuesta es `application/scim+json`. Las llamadas están en el registro de auditoría con el nombre del token como actor, así que `user.created`, `user.disabled` y el resto dicen qué proveedor lo hizo, junto con los eventos SCIM `scim.user_deleted`, `scim.group_created`, `scim.group_updated` y `scim.group_deleted`.

### Qué ofrece

`/ServiceProviderConfig`, `/ResourceTypes` y `/Schemas` dicen qué se admite, y solo dicen lo que es verdad: filtrado, PATCH, sin bulk, sin ordenación, sin ETags, sin cambios de contraseña.

| Recurso | Llamadas |
|---|---|
| `/Users` | `GET` (lista, con `filter`, `startIndex`, `count`, `attributes`, `excludedAttributes`), `POST`, `GET /{id}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}` |
| `/Groups` | lo mismo |
| `/.search`, `/Users/.search`, `/Groups/.search` | `POST` con la consulta en el cuerpo |

- **Un usuario** es `userName`, `externalId`, `name` (`formatted`, `givenName`, `familyName`), `displayName`, `emails` y `active`. El correo de la cuenta es el principal, si no el de trabajo, si no el primero, si no `userName` cuando es una dirección. Cualquier cosa sin dirección es un 400. Lo que envía el proveedor se devuelve tal como lo envió: un nombre que no envió no se inventa. `groups` vuelve de solo lectura.
- **Un grupo** es `displayName`, `externalId` y `members`, cada miembro el id de un usuario. Un miembro que no es un usuario es un 400.
- **Los filtros** son la sintaxis completa: `eq ne co sw ew gt ge lt le pr`, `and`, `or`, `not`, paréntesis y `attr[filter]`. La coincidencia no distingue mayúsculas salvo en `id` y `externalId`. Un filtro incorrecto es un 400 con `scimType: invalidFilter`.
- **PATCH** admite `add`, `replace` y `remove` con o sin ruta, con rutas de valor como `emails[type eq "work"].value` y `members[value eq "id"]`, con cualquier capitalización, y un booleano como `true` o como la cadena `"False"` que envían algunos proveedores. Cambia exactamente lo que podría cambiar un PUT.
- **Las listas** van en el orden en que se crearon las cuentas, 100 por página salvo que `count` diga otra cosa, 200 como máximo.

### Lo que no hará

- **Nunca muestra ni cambia al propietario.** El propietario de la instancia no está en la lista, no se puede obtener, modificar ni borrar, y no se puede poner en un grupo. Un correo que pertenece al propietario es un conflicto.
- **Nunca borra una cuenta.** `DELETE` desactiva a la persona, lo que termina sus sesiones, la saca de sus grupos y la oculta de SCIM. Todo lo que creó y cada fila de auditoría se queda. Si el proveedor la crea otra vez con la misma dirección, vuelve la misma cuenta, activada. `active: false` hace la desactivación sin ocultarla.
- **Una cuenta SCIM no tiene contraseña.** Inicia sesión con OIDC, SAML o LDAP, que se enlazan a ella por la dirección.
- **No toca los proyectos.** SCIM trabaja con cuentas y roles de la instancia. Quién está en qué proyecto se sigue decidiendo aquí.

### Roles a partir de grupos

De forma predeterminada una cuenta nueva es miembro y SCIM nunca cambia el rol de nadie. Para que decidan los grupos, asigne nombres de grupo a roles:

```
HOTLOOP_CASCADE_SCIM_ROLES="Plant Admins=admin, Plant Members=member"
HOTLOOP_CASCADE_SCIM_DEFAULT_ROLE=member
```

Entonces el rol de una persona sigue a sus grupos cada vez que cambia una pertenencia: gana el rol asignado más poderoso, y quien no está en ninguno recibe el valor predeterminado. Solo `admin` y `member` se pueden asignar, porque un proveedor nunca crea un propietario. Use una sola fuente de roles. Si OIDC o SAML también asignan grupos a roles, gana el que cambió por última vez el rol de una persona, y los dos se pelearán.

El proveedor necesita los mismos nombres de grupo, y tiene que enviar los grupos con sus miembros, lo que puede hacer todo proveedor que admita grupos SCIM.
