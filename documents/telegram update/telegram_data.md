Available MTProto servers
Test configuration:
149.154.167.40:443
DC 2

Public keys:
-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAyMEdY1aR+sCR3ZSJrtztKTKqigvO/vBfqACJLZtS7QMgCGXJ6XIR
yy7mx66W0/sOFa7/1mAZtEoIokDP3ShoqF4fVNb6XeqgQfaUHd8wJpDWHcR2OFwv
plUUI1PLTktZ9uW2WE23b+ixNwJjJGwBDJPQEQFBE+vfmH0JP503wr5INS1poWg/
j25sIWeYPHYeOrFp/eXaqhISP6G+q2IeTaWTXpwZj4LzXq5YOpk4bYEQ6mvRq7D1
aHWfYmlEGepfaYR8Q0YqvvhYtMte3ITnuSJs171+GDqpdKcSwHnd6FudwGO4pcCO
j4WcDuXc2CTHgH8gFTNhp/Y8/SpDOhvn9QIDAQAB
-----END RSA PUBLIC KEY-----
Production configuration:
149.154.167.50:443
DC 2

Public keys:
-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEA6LszBcC1LGzyr992NzE0ieY+BSaOW622Aa9Bd4ZHLl+TuFQ4lo4g
5nKaMBwK/BIb9xUfg0Q29/2mgIR6Zr9krM7HjuIcCzFvDtr+L0GQjae9H0pRB2OO
62cECs5HKhT5DZ98K33vmWiLowc621dQuwKWSQKjWf50XYFw42h21P2KXUGyp2y/
+aEyZ+uVgLLQbRA1dEjSDZ2iGRy12Mk5gpYc397aYp438fsJoHIgJ2lgMv5h7WY9
t6N/byY9Nw9p21Og3AoXSL2q/2IJ1WRUhebgAdGVMlV1fkuOQoEzR7EdpqtQD9Cs
5+bfo3Nhmcyvk5ftB0WkJ9z6bNZ7yxrP8wIDAQAB
-----END RSA PUBLIC KEY-----


api_id: 34091426
api_hash: 30113306f9edfb0af1b029176627f7d1

## Pasos para obtener credenciales de Telegram (Userbot)

Para que el sistema Taximast pueda conectarse a una línea de Telegram, necesitas obtener un `api_id` y un `api_hash` siguiendo estos pasos:

1.  **Iniciar sesión:** Ve a [https://my.telegram.org](https://my.telegram.org) e ingresa el número de teléfono de la línea que vas a usar. Recibirás un código de confirmación **dentro de la app de Telegram**.
2.  **Herramientas de desarrollo:** Una vez dentro, haz clic en el enlace **"API development tools"**.
3.  **Crear aplicación:** Si es la primera vez, verás un formulario:
    *   **App title:** Pon algo descriptivo (ej: `Taximast Dispatch`).
    *   **Short name:** Un nombre corto sin espacios (ej: `taximast_linea1`).
    *   **URL:** Puedes dejarlo en blanco o poner la URL de tu panel.
    *   **Platform:** Selecciona `Desktop` o `Other`.
    *   **Description:** Opcional.
4.  **Obtener claves:** Al guardar, se te mostrarán dos valores críticos:
    *   **App api_id**: Un número de varios dígitos.
    *   **App api_hash**: Una cadena alfanumérica larga.
5.  **Configuración en Taximast:** Copia estos valores y pégalos en el panel de Administración de Taximast, en la sección de la línea correspondiente.

> [!IMPORTANT]
> **No compartas nunca tu `api_hash`**. Es la llave maestra de tu cuenta. Si crees que se ha filtrado, puedes regenerarla en el mismo portal.

> [!TIP]
> Si el portal `my.telegram.org` te da error al crear la app (a veces pasa por saturación), intenta usar un nombre de aplicación más largo y único, o prueba desde una ventana de incógnito.

ejecutar  node scripts/tg_auth.mjs para obtener las credenciales de session id