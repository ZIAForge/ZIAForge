<!-- Generated from docs/help/en.json; source SHA-256 910098d2b61e07851b0a1433429a6bf1ee342749ea1fdc4885d1e63afda3cd7f. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: es; served locale: es; status: machine-translated. -->
# Guía del usuario de ZIAForge

De la intención a un resultado verificado. Una guía práctica de Code, Work y control de la aplicación.

El inglés es canónico. La ayuda traducida automáticamente se etiqueta por separado de las traducciones revisadas por personas. Las comprobaciones automatizadas no certifican la precisión en el idioma nativo.

> Esta guía ha sido traducida automáticamente a partir de la fuente actual en inglés. La revisión humana sigue siendo bienvenida.

## Secciones de la guía

- [Primeros pasos](#start)
- [Instalar el paquete de escritorio correcto](#install-platforms)
- [Code: cinco rutas](#code)
- [Discusión de Forge](#forge)
- [Documentos y decisiones](#decisions)
- [Ejecución y revisión](#execution)
- [Equipos de revisión paralela y el arquitecto de informes](#review-teams)
- [Especializaciones de agentes y directiva de instrucciones](#specializations)
- [Work: de la pregunta al documento](#work)
- [Ajustes predefinidos, modelos y acceso](#models)
- [Chats, Detener y la cola](#chat)
- [Archivos, Git y finalización](#files)
- [API connections](#api)
- [Ajustes, idiomas y restablecimiento seguro](#settings)
- [Consultar al asistente de Ayuda](#help-assistant)
- [Asistente y Telegram](#assistant-control)
- [Operar su bot privado de Telegram](#telegram)
- [Permiso nativo de equipo exclusivo del propietario](#native-permissions)
- [Navegador e instancias remotas](#remote)
- [OpenClaw, Hermes y otros agentes externos](#external-agents)
- [CLI local y límites de automatización](#local-cli)
- [Versión y actualizaciones](#updates)
- [Reinicio y recuperación](#restart)
- [Solución de problemas](#troubleshooting)
- [Informar problemas e inspeccionar evidencias](#diagnostics)
- [Datos locales y límites](#privacy)
- [Comprender y modificar este proyecto de código abierto](#project-contributors)

<a id="start"></a>

## Primeros pasos

ZIAForge mantiene la discusión, la planificación, la ejecución y la verificación en una sola tarea. Elija Code para un proyecto de Git, o Work para documentos, investigación y otros resultados en una carpeta común.

Comience con una tarea pequeña en un proyecto independiente. Si elige un CLI nativo, instálelo e inicie sesión primero con su propia cuenta en un terminal. Como alternativa, configure una conexión API. Una suscripción a CLI y una suscripción de pago a API son métodos de conexión independientes; ZIAForge no inicia sesión por usted ni transfiere créditos entre ellos.

1. Abra Ajustes y compruebe la carpeta del espacio de trabajo y el idioma. Acerca de muestra la identidad exacta de la versión en ejecución.
2. Para Code, añada un repositorio de Git en la barra lateral. Para Work, elija una carpeta independiente al crear la tarea.
3. Guarde un ajuste predefinido con un CLI, modelo, esfuerzo de razonamiento y nivel de acceso. También puede seleccionar Personalizado directamente sin un ajuste predefinido guardado.
4. Cree una tarea, elija su ruta, roles y avance manual o automático. Revise las elecciones antes de Iniciar.

> Utilice el artefacto y la suma de comprobación proporcionados por el responsable de mantenimiento. Una vista previa puede no estar firmada o carecer de un canal de actualizaciones publicado. El soporte de escritorio y de proveedores nativos debe verificarse para el OS exacto, arquitectura y artefacto; el soporte del código fuente por sí solo no es una certificación de lanzamiento.

Instrucciones relacionadas: [Descripción general del proyecto](../../../README.md) · [Compatibilidad de proveedores](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## Instalar el paquete de escritorio correcto

Elija un paquete para su sistema operativo y arquitectura de CPU: x64 o arm64. La canalización de compilación puede producir formatos macOS DMG/ZIP, instalador Windows NSIS/ZIP, y Linux DEB/RPM/AppImage/tar.gz/ZIP. Un archivo generado o compilación cruzada no es prueba de que su instalador y UI nativo hayan pasado en su máquina; consulte el registro de verificación de esa versión.

Las compilaciones de macOS que usan Electron 44 requieren macOS 13 o posterior. Utilice el paquete arm64 en Apple Silicon y el paquete x64 para Intel. Cierre completamente una aplicación anterior antes de reemplazarla. Los paquetes de vista previa pueden no estar firmados ni notarizados; no confunda un artefacto de desarrollo con un lanzamiento público firmado.

Windows necesita un sistema operativo compatible con la versión incluida de Electron y que Git esté disponible en PATH. Elija la arquitectura correspondiente. Una vista previa sin firmar no cuenta con la certificación Authenticode. Un ZIP portátil debe conservar el directorio completo de la aplicación y los archivos en tiempo de ejecución, no solo su ejecutable.

Linux necesita un escritorio gráfico compatible, las bibliotecas del sistema requeridas por Electron y Git. Para credenciales de control cifradas, proporcione un servicio Secret Service en funcionamiento como gnome-libsecret o KWallet; no se acepta el backend inseguro basic_text. Las pruebas superficiales en contenedores/sin interfaz gráfica (headless) no certifican cada escritorio o distribución.

Instale un DEB con apt install ./file.deb, o instale un RPM mediante el gestor de paquetes de su distribución. Un AppImage necesita permiso de ejecución y soporte adecuado de FUSE; --appimage-extract-and-run es una alternativa donde sea compatible. Extraiga los paquetes tar.gz y ZIP con todos sus archivos en tiempo de ejecución. Mantenga diferenciados los datos del usuario y los archivos de la aplicación al reemplazar un paquete.

Para compilar desde el código fuente, utilice Node 24, Git y npm ci, incluyendo el instalador estándar de Electron. Las recompilaciones nativas requieren herramientas de plataforma: herramientas de línea de comandos de Xcode en macOS; MSVC C++, Windows SDK y Python en Windows; compilador, make, Python, pkg-config y las herramientas de empaquetado requeridas en Linux. Siga PLATFORM_BUILDS.md para conocer los comandos exactos y los límites actuales de la plataforma.

Las versiones de lanzamiento se reservan centralmente y las salidas son inmutables. Una compilación de verificación de CI no es un instalador publicado. Los archivos fuente contienen código, archivo de bloqueo (lockfile), documentación y scripts; se excluyen dependencias, credenciales, perfiles de usuario e investigaciones privadas. Nunca infiera una validación nativa de ARM o Windows a partir de una compilación correcta de x64.

Instrucciones relacionadas: [Paquetes de plataformas, prerrequisitos y límites de verificación](../../PLATFORM_BUILDS.md) · [Identidad de compilación y comprobaciones de lanzamiento](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: cinco rutas

Auto evalúa el alcance: una pregunta simple puede terminar con una respuesta, mientras que una tarea mayor necesita preparación. Corregir un error investiga una causa y prepara una corrección. Especificación primero comienza con la solución técnica; Requisitos primero comienza con los requisitos y los criterios de aceptación.

Multimodelo utiliza contextos separados para exploración, diseño, implementación y revisión. El nombre de la ruta no requiere proveedores diferentes: cada rol utiliza el ajuste predefinido o la configuración Personalizada que elija.

Un árbol de trabajo aísla los cambios de Git de una tarea. Rama trabaja en la copia de trabajo seleccionada. Compruebe el proyecto, la rama y el modelo antes de comenzar; la descripción de la tarea no se envía también a un chat ordinario.

Para una idea con decisiones técnicas o de producto sin resolver, utilice Requisitos primero y construya los cimientos en la discusión. Auto clasifica la solicitud; no es una orden para implementar cada frase corta de inmediato. Guardar borrador retiene la solicitud sin contactar a un modelo; Iniciar guarda y lanza el flujo gestionado una vez. De una a cuatro copias de tarea tienen identificadores de creación y ajustes de rol independientes.

Instrucciones relacionadas: [Contrato de flujo de trabajo de Code](../../WORKFLOWS.md) · [Perfiles de instrucciones de Code](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Discusión de Forge

Iniciar abre la discusión central. Responda con naturalidad, haga contrapreguntas, añada restricciones y debata decisiones técnicas. La conversación y las preguntas permanecen con la tarea.

Enviar texto no acepta un documento ni autoriza un nuevo plan de implementación. Una aclaración durante la ejecución primero pausa el turno gestionado y revisita el alcance afectado. La respuesta a una pregunta dentro de un paso ya aceptado puede continuar ese paso.

Para revisar deliberadamente los cimientos, seleccione Requisitos, Especificación o Planificación. Una nueva versión requiere una nueva aceptación de las decisiones dependientes. Los pasos completados y sus pruebas permanecen; las fases no finalizadas que hayan sido sustituidas se mantienen en el historial.

Las sesiones de fases gestionadas difieren del chat libre. Utilice la discusión de Forge en lugar de enviar instrucciones manuales directamente a una sesión perteneciente al flujo de trabajo.

Instrucciones relacionadas: [Contrato de discusión de Forge](../../WORKFLOWS.md).

<a id="decisions"></a>

## Documentos y decisiones

Abra un documento, inspeccione su versión y realice ediciones cuando sea necesario. Enviar ediciones a través de la discusión produce una nueva versión; los informes y los resultados verificados no se reescriben retrospectivamente.

Antes de aceptar un plan propuesto, edite el orden, las instrucciones, los criterios de aceptación y los comandos de verificación. Autorice comandos concretos que comprenda: se ejecutan en la carpeta de la tarea. Multimodelo propone un único paso de implementación para toda la tarea, con detalles en sus documentos e instrucciones.

Aprobar es una decisión deliberada independiente. Auto no elude las preguntas ni la aceptación de requisitos, especificaciones y planes. Un documento modificado externamente no puede reutilizar una aprobación antigua.

Los archivos de preparación aparecen como artefactos. Su versión, fase de producción y hash los vinculan a un resultado. Los documentos de Code se conservan fuera del árbol de trabajo y no entran automáticamente en una confirmación.

Compruebe tanto el documento como la decisión mostrada antes de aceptar. La aceptación vincula la ID de control actual, la revisión del plan y los hashes de documentos retenidos. Solicite cambios cuando el alcance o las pruebas sean incorrectos. Si una decisión quedó obsoleta, vuelva a cargar el estado guardado antes de tomar una nueva decisión; un archivo modificado no puede aceptarse bajo una versión anterior.

Instrucciones relacionadas: [Puertas de flujo de trabajo y versiones de documentos](../../WORKFLOWS.md).

<a id="execution"></a>

## Ejecución y revisión

Tareas pendientes muestra pasos reales, el intento actual, la verificación y los resultados de la revisión. Que un agente diga «hecho» no completa un paso: las pruebas requeridas por el plan deben existir.

El modo manual pausa entre pasos aptos. Auto avanza los pasos verificados y permite reintentos acotados. Detener después de siempre crea un punto de control. Pausa detiene el trabajo activo del flujo de trabajo; cerrar un panel no lo detiene.

Un revisor independiente utiliza un contexto separado con archivos y resultados de verificación. Todo hallazgo bloqueante requerido debe resolverse; múltiples revisores no anulan por votación un error bloqueante.

En Multimodelo, corregir los hallazgos requiere una decisión explícita. Una corrección no inicia silenciosamente otra revisión: Revisar de nuevo abre un ciclo nuevo. Los comentarios de revisión pueden solicitar la reconsideración del coordinador sin repetir la implementación.

Los pasos completados no pueden editarse silenciosamente. Con TDD, Rojo debe fallar realmente por la razón esperada, y luego Verde debe pasar. Los intentos acotados evitan reintentos infinitos.

Guarde revisores independientes de CLI/API en Ajustes → Equipos de revisión, luego seleccione el equipo en Code o Work. Los revisores se ejecutan en paralelo, seguidos por el arquitecto de informes del equipo. También puede configurar revisores independientes sin un equipo guardado. El arquitecto de informes solo recibe informes estructurados anónimos, sin archivos del proyecto ni herramientas; este aislamiento requiere actualmente Claude Code o API.

Cada paso de implementación necesita una comprobación ejecutable, una revisión independiente requerida, o ambas. Las fases de preparación, en cambio, retienen resultados validados y comprobantes de artefactos; estos no pretenden simular que las pruebas de implementación se ejecutaron. Un comando tiene éxito únicamente cuando se confirman su estado de salida real y la limpieza de los procesos propios. Una comprobación en Rojo para TDD debe fallar normalmente antes de la implementación y de la verificación en Verde; la falta de un ejecutable o un tiempo de espera agotado no es un resultado Rojo válido.

Los disyuntores predeterminados se detienen tras tres intentos fallidos en un paso o cincuenta intentos en total. La interrupción consume un intento, pero no cuenta por sí misma como un intento fallido. Los límites y las pruebas completadas persisten tras reiniciar; Reintentar no los restablece. Lea el fallo retenido antes de autorizar otro intento.

Instrucciones relacionadas: [Verificación y revisión](../../WORKFLOWS.md).

<a id="review-teams"></a>

## Equipos de revisión paralela y el arquitecto de informes

Abra Ajustes → Equipos de revisión y guarde un equipo. Añada revisores independientes con su propio CLI o API, modelo, esfuerzo de razonamiento y especialización, luego elija un arquitecto de informes. Seleccione el equipo en la configuración de revisión de la tarea. Un ajuste predefinido de ejecutor también puede ser utilizado por un revisor, y Personalizado sigue disponible; los roles independientes siguen teniendo contextos separados.

Los revisores se ejecutan en paralelo sobre las mismas pruebas de la tarea. Cada informe requerido, error y veredicto se retiene. El arquitecto recibe informes anónimos numerados sin nombres de revisores, identidades de modelo o proveedor, contenido original de la tarea, acceso al repositorio ni herramientas. Compara informes y devuelve un único veredicto estructurado; no realiza una nueva revisión del código fuente.

Un hallazgo bloqueante o el rechazo de un revisor requerido no pueden ser descartados por votación mayoritaria ni por preferencia del arquitecto. La falta de informes o la presencia de informes malformados impiden la aprobación. Inspeccione los hallazgos individuales y la decisión agregada antes de aceptar o autorizar correcciones. Un equipo guardado se resuelve y se congela para la ejecución; editar su ajuste predefinido no reescribe las pruebas completadas.

El arquitecto de solo informes utiliza actualmente configuraciones compatibles sin herramientas de Claude o API. Codex y Antigravity siguen disponibles como revisores pero se rechazan para este rol aislado de arquitecto hasta que exista un contrato verificado sin herramientas. Una instrucción que diga «sin herramientas» por sí sola no es suficiente.

> La canalización de diseño/revisión de Code Multimodelo y un equipo de revisión paralela guardado son controles independientes. Mantenga la política de revisión personalizada seleccionada; no asuma que una ruta habilita todas las funciones de revisión.

Instrucciones relacionadas: [Configuración de equipos tipados](../../../shared/review-team.ts) · [Agregación de revisiones](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## Especializaciones de agentes y directiva de instrucciones

Un modelo es el motor de ejecución; una especialización es un perfil de instrucciones. Elija Ninguno para no añadir especialización, Estándar para la guía predeterminada, Auto para una guía integrada relevante, o Manual para guías seleccionadas y sus propias instrucciones acotadas. Los ajustes predefinidos pueden retener la selección.

El catálogo original cubre codificación general, arquitectura, seguridad, fiabilidad, rendimiento, pruebas y usabilidad de interfaz. Auto utiliza el texto disponible de la tarea/paso para seleccionar una guía; no llama en secreto a otro modelo ni certifica pericia. Las sugerencias de planificación se pueden inspeccionar y modificar antes de aceptar el plan de implementación.

Las especializaciones de revisión ayudan a dirigir la atención, pero nunca reemplazan las pruebas independientes, los límites de acceso o el veredicto estructurado. Trate las instrucciones personalizadas como parte del alcance de la tarea: no las use para eludir la aceptación de documentos, la política de herramientas, la autenticación o los fallos de los revisores.

Instrucciones relacionadas: [Catálogo original de instrucciones](../../../shared/specializations.ts).

<a id="work"></a>

## Work: de la pregunta al documento

Work no requiere Git. Por defecto crea una carpeta de tarea independiente; Personalizado selecciona una carpeta existente mediante el selector nativo. Guardar borrador almacena los ajustes sin inferencia; Iniciar ejecuta la primera fase.

Auto responde directamente o propone un plan adecuado con tareas pendientes reales. Lluvia de ideas crea ideas.md antes de que elija más ideas o evaluación. Investigación conserva findings.md, fuentes y limitaciones. Redacción avanza desde la intención y, cuando es útil, outline.md hacia un documento descriptivo o draft.md; las revisiones conservan versiones anteriores.

Seleccione los archivos de entrada a través del selector nativo y referéncielos con @. La aplicación los copia como entradas inmutables de la tarea y valida su identidad antes de una ejecución. Por defecto crea una carpeta de tarea propiedad de la aplicación; el acceso a la carpeta Personalizada es una concesión guardada del propietario. Un borrador guardado y no iniciado puede cambiar su carpeta.

Cree de 1 a 4 copias con configuraciones de ejecutor independientes. Las tareas que usan carpetas superpuestas no pueden escribir simultáneamente. Esta coordinación se aplica a operaciones de ZIAForge, no a programas externos arbitrarios.

Lluvia de ideas profunda utiliza por defecto tres trabajadores independientes y admite hasta ocho. Seleccione su orden y configuraciones, incluida la reutilización de un ajuste predefinido en contextos separados. Las preguntas de los trabajadores conservan su origen; los informes malformados reciben un intento de reparación de formato. El fallo parcial permanece visible en lugar de presentarse como un éxito unánime.

Profunda combina los informes conservados de los trabajadores en brainstorm_report.md y siempre solicita una decisión del usuario. Un seguimiento menor revisa el informe a través del coordinador; un cambio mayor inicia otra ronda de los trabajadores congelados. Los artefactos conservan sus versiones.

Los roles resueltos se congelan en la creación de la tarea o al guardar explícitamente el borrador. Tras la primera invocación, solo puede cambiar el avance automático/manual; utilice una nueva tarea para ajustes de rol o modelo diferentes. Editar un ajuste predefinido global no cambia silenciosamente fases posteriores.

El modo manual hace una pausa entre fases aptas, incluido un esquema sustancial de Redacción. Auto puede continuar a través de ese esquema. Las preguntas, los planes ejecutables propuestos, la dirección de Lluvia de ideas y la revisión de informes de Profunda siguen siendo decisiones explícitas incluso en Auto. Una cita por sí sola no prueba que se haya navegado por la web, y un archivo binario conservado por sí solo no prueba su renderización.

Instrucciones relacionadas: [Modos y decisiones de Work](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## Ajustes predefinidos, modelos y acceso

Un ajuste predefinido guarda un CLI/API, modelo, esfuerzo de razonamiento y permisos. El pie de página del chat tiene segmentos de ajuste predefinido, CLI, modelo y opciones. Personalizado funciona sin un ajuste predefinido; Crear ajuste predefinido guarda la selección actual.

El catálogo proviene del CLI o API instalado y seleccionado donde sea compatible. Actualizar pone al día la lista sin cambiar la selección. Si el descubrimiento no está disponible, introduzca un ID de modelo explícito; el proveedor aún debe admitirlo. Los niveles de razonamiento dependen del modelo y de CLI. El valor predeterminado del proveedor es distinto del token explícito none.

Aplique los cambios solo tras el reconocimiento del backend. El cambio está restringido durante un turno activo o una cola no vacía. Los borradores y el historial visible se conservan, pero cambiar de proveedor no transfiere su estado interno privado.

En Forge, la etiqueta del rol importa: la preparación puede usar un Planificador independiente. El pie de página cambia el rol mostrado; los revisores y ayudantes se seleccionan en la configuración del flujo de trabajo. La directiva para la implementación ya verificada puede estar bloqueada.

Los permisos difieren entre proveedores. Solo lectura y Escritura en espacio de trabajo están disponibles donde el adaptador los admita. Antigravity utiliza la configuración nativa de CLI o el acceso total seleccionado explícitamente. El acceso total no es un entorno aislado (sandbox).

La especialización añade orientación mediante instrucciones, no otro modelo o permiso. Los ajustes predefinidos y roles admiten Ninguno, Estándar, Auto y Manual. Auto selecciona perfiles a partir del texto del paso sin una llamada adicional al modelo; Manual acepta hasta cuatro especialidades e instrucciones personalizadas. Las asignaciones propuestas por el Planificador se pueden editar antes de aceptar el plan.

Un ID de modelo o esfuerzo introducido manualmente sigue siendo su elección, pero el proveedor puede rechazarlo. Editar un ajuste predefinido global no cambia retroactivamente un chat en ejecución ni un plan aceptado. Para modificar deliberadamente una conversación inactiva, use sus propios controles de configuración y espere el reconocimiento. Una opción deshabilitada debe interpretarse como un límite de capacidad o de ciclo de vida, no eludirse editando el JSON guardado.

Instrucciones relacionadas: [Capacidades del proveedor](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## Chats, Detener y la cola

Las pestañas abiertas, Recientes y los borradores pertenecen a una sola tarea. Cerrar una pestaña la elimina de Abiertas pero la conserva en Recientes y no detiene el proceso de su proveedor ni el flujo de trabajo gestionado. Busque en el historial, vuelva a abrir un chat o cierre todas las pestañas adicionales desde el menú del historial.

Detener interrumpe el turno actual. Espere a que termine de detenerse antes del siguiente Enviar: el reconocimiento de interrupción no es la finalización del proceso. Mientras tanto, puede escribir el siguiente borrador.

En un chat normal, Cola guarda una solicitud posterior de forma independiente del borrador actual. Pausar cola retiene entregas posteriores. Detener y Salir pausan la cola. Tras reiniciar, primero Reanudar y luego Continuar cola explícitamente.

Incierto significa que la entrega es desconocida. Dicho mensaje no se vuelve a enviar automáticamente: inspeccione el historial, copie el texto si procede y descarte el elemento en cola. Enviarlo de nuevo es una nueva solicitud deliberada.

Los chats de fases gestionadas utilizan su flujo de trabajo, no la cola normal. Seguir etapa muestra la fase actual; seleccionar manualmente otra pestaña deja de seguirla. Los registros de CLI muestran los diagnósticos por separado de la respuesta.

Las respuestas en Markdown renderizan encabezados, listas, tablas, enlaces y código en bloques. Las tarjetas de herramientas y los diagnósticos de CLI permanecen separados de la respuesta. El razonamiento reportado por el modelo y las métricas de tokens solo aparecen cuando el proveedor realmente los expone; no infiera razonamiento privado o uso a partir de la animación.

Tras un envío incierto o un acuse de recibo de cola, inspeccione el historial y reintente únicamente la misma solicitud retenida donde se ofrezca. Un recibo de cola significa que el almacenamiento aceptó el elemento, no que la inferencia haya finalizado. Elimine un elemento incierto en cola solo como un descarte explícito; no puede retirar una instrucción ya entregada.

Instrucciones relacionadas: [Cola de mensajes duradera](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## Archivos, Git y finalización

Archivos muestra la carpeta de la tarea. Compare los resultados con los requisitos, abra documentos e inspeccione diferencias. Conservar un archivo binario no demuestra una renderización correcta en su aplicación de destino.

Git proporciona estado, cambios y operaciones con resultados registrados. Confirmar, fusionar y publicar son manuales por defecto; las operaciones automáticas son opciones independientes para un plan completamente verificado.

No modifique los archivos de trabajo entre la verificación y la publicación: la aprobación está ligada a los bytes exactos. Los conflictos, las publicaciones fallidas y los resultados de operaciones desconocidos bloquean el progreso hasta una decisión explícita. Auto no autoriza silenciosamente la publicación.

Work no crea ramas de Git y no tiene finalización de Git. Conserve los documentos requeridos de la carpeta seleccionada, incluidas versiones y fuentes.

El editor de archivos proporciona resaltado de sintaxis según la extensión, búsqueda y reemplazo, historial de deshacer, ajuste de línea y borradores por pestaña. Los guardados preservan la codificación UTF-8/UTF-16 compatible y rechazan conflictos de modificación externa. Otras codificaciones y contenidos binarios necesitan un editor externo. Los borradores sin guardar impiden Salir de la aplicación hasta que el propietario los guarde o descarte.

La sintaxis completa se habilita hasta 8 MiB. Los archivos de texto más grandes se abren en ventanas de 256 KiB; 8–64 MiB se pueden cargar explícitamente por completo sin sintaxis. Por encima de 64 MiB, use la edición por ventanas y la búsqueda acotada de la siguiente coincidencia. Este es un modo limitado para archivos grandes, no una paridad con Sublime Text para documentos arbitrariamente grandes.

Abrir carpeta utiliza el contexto de la tarea actual o de la rama/árbol de trabajo, en lugar de abrir silenciosamente solo el repositorio original. Una fila de archivo puede mostrar el directorio principal de ese archivo. Las rutas son validadas por el backend contra los permisos de tarea registrados. Los archivos binarios no se pueden editar como texto sin formato; utilice su visor de destino y conserve los bytes originales.

La eliminación del árbol de trabajo es una acción protegida independiente. Finalice las sesiones estructuradas y terminales adjuntas antes de eliminarlo, incluidas las sesiones inactivas. Inspeccione el resultado guardado de Git y el estado de recuperación; eliminar un registro de tarea no sustituye la conservación segura del trabajo no confirmado.

Instrucciones relacionadas: [Contrato de editor tipado](../../../shared/editor.ts) · [Políticas de Git](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> La guía completa aún no está traducida a su idioma de interfaz. Mostrando la referencia en inglés.

Connections adds an explicitly selected OpenAI-compatible endpoint. Enter a name, base URL, model and a key if needed. Select Chat Completions for existing integrations or Responses for function rounds, provider tool progress and generated images. Existing connections retain Chat Completions until you change them explicitly. For an existing connection, Set up Responses opens a draft for that same endpoint; review the profile and click Save connection. Choose Codex connector or Grok Connector v1 only for a gateway that supports that extension. The saved key is retained when the endpoint is unchanged and the key field stays blank.

HTTPS is required except for loopback HTTP. Use a plain endpoint without credentials, queries or fragments. Redirects are refused. Keys use supported OS encryption and are never returned to the UI. Changing the endpoint requires re-entering or clearing its key. Leaving the key field blank preserves a saved key.

Workspace file tools execute in the backend-resolved local task folder, with relative paths and checks against traversal and links. Every file write needs explicit approval and an unchanged expected revision. Read-only sessions expose only read tools. In Responses, Allow local commands separately enables approved executable/argument calls on macOS and Linux. Command supervision is unavailable on Windows; the adapter does not advertise that tool there. Commands always require owner approval and are not an operating-system sandbox.

The Codex connector profile identifies that gateway’s Responses tool-progress extension. Native provider tools execute on the server, separately from caller tools on your computer. Local read-only permissions do not constrain the server. A connector cannot be selected for a report-only architect that requires all tools disabled: unsupported isolation fails rather than silently allowing native tools. Select an endpoint that can enforce the required policy.

Generated PNG, JPEG and WebP results appear as separate image cards, with Save image, outside collapsed tool output. Images are validated and kept in private application storage; model-supplied URLs and Markdown images are not fetched automatically. Opening saved history, retrying an image read and saving a cached image do not request a new generation. Results are bounded to 32 MiB and 32 million pixels per image, with a 128 MiB private cache. Preserve needed images before manually clearing the private cache if it becomes full. Click a chat image to open the image viewer. Zoom in or out, choose Actual size (100%) or Fit to window, and drag to inspect a detail. Escape or Close image viewer returns to the chat. Viewing and zooming reuse the loaded private image; they do not request a new generation.

Responses conversations retain the acknowledged response identity and exact function call IDs. Interrupted inputs are not automatically resent. An uncertain local edit or command is not rerun after restart; preserve the history and explicitly create a new context after inspection. Changes to a saved transport or endpoint require explicit reconfiguration. Provider status, cancellation and expiry failures are reported without hiding them behind a CLI fallback. The chat header shows the protocol pinned to that run. After saving connection changes, open the chat’s CLI / API selector and click Apply, even if the same connection is already selected. This creates a new run with the saved configuration and retains chat history. Saving a connection alone does not migrate active chats. Older text-only image links remain text; switching protocol does not regenerate or import previous results.

API connections use their configured endpoint and authentication, separately from native CLI subscriptions. Some gateways use subscriptions internally; ZIAForge does not copy native authentication into an API. Models, tool policies, reasoning parameters and billing depend on the endpoint. Discovery alone does not prove inference. Keep keys in Connections, never in task prose or screenshots.

For Grok Connector v1, save an explicit Responses connection and use Inspect connector to read its advertised capabilities, models and usage without running inference. Model reasoning levels and context window choices come from the catalog. The optional native turn limit is 1–100. Missing quota percentages remain unknown; the usage period end is not a subscription payment or expiration date. Apply connection changes in each existing chat before they take effect there.

Grok questions appear as cards with the exact native question and option labels. Choose the requested answers or enter a custom response, then send once. Plan interviews can offer discussion or skip actions. Provider permission cards show the exact native choices and never select a permission automatically. These differ from local file/command approvals. Stop, expiry or restart makes old cards inactive; an uncertain submission is not repeated automatically.

In a Grok chat, the attachment button opens the system picker for PNG, JPEG and WebP. Four images are allowed per message, up to 16 MiB each and 20 MiB combined, with 32 million pixels per image. Private draft copies have a 128 MiB budget and belong to that chat run. They are transmitted only when you send. Failed or uncertain sends retain their draft identities. Image messages cannot use the text-only queue. Remove or explicitly discard a pending image draft before changing or resuming its run; discarding a draft does not undo an already delivered message. Accepted image messages retain private image cards for later inspection, zoom and saving.

Grok provider tools are restricted to supported web retrieval, images and interactive questions. Local project tools still execute on the computer in the backend-selected task folder. Read-only review excludes provider image generation/editing and questions as well as local writes and commands. Tool-free Help and report-only architect sessions cannot use this connector profile. Audio and video generation/playback are not offered; a discovered tool is not evidence of a verified usable result.

Instrucciones relacionadas: [API connections](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md).

<a id="settings"></a>

## Ajustes, idiomas y restablecimiento seguro

La configuración general selecciona el espacio de trabajo, el idioma de la interfaz y los valores predeterminados. Conexiones gestiona los puntos de conexión de API. Ajustes predefinidos y Equipos de revisión conservan las configuraciones de los roles. Control remoto gestiona las credenciales locales, el alcance del servidor y los permisos del propietario; Actualizaciones gestiona la fuente/canal de lanzamiento. Acerca de muestra la compilación exacta en ejecución.

El idioma de la interfaz es independiente del idioma de las instrucciones y del estado de revisión de la documentación. Los nombres de productos, los identificadores de comandos, las extensiones de archivos, los identificadores de modelos de proveedores y los nombres creados por el usuario se mantienen como identificadores. La Ayuda sigue el idioma de interfaz seleccionado cuando hay una traducción actual disponible; las traducciones automáticas están etiquetadas y el inglés sigue siendo la referencia canónica.

Guardar aplica la configuración mostrada. Un restablecimiento de la base de datos o de fábrica puede eliminar los metadatos de la aplicación; conserve los archivos y una copia de seguridad probada antes de utilizar el restablecimiento de forma intencionada. Estas operaciones son acciones exclusivas del propietario local. No las utilice como atajo para investigar un flujo de trabajo fallido o un registro corrupto.

Instrucciones relacionadas: [Instrucciones de localización](../../LOCALIZATION.md) · [Recuperación de datos](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## Consultar al asistente de Ayuda

Abra la Ayuda, elija un ajuste preestablecido conectado y guardado en su panel de asistente y pregunte sobre ZIAForge. Las respuestas utilizan la guía canónica actual en inglés y el idioma seleccionado de su interfaz. Los botones de referencia de sección abren los temas pertinentes de la guía, lo que le permite comparar la explicación con la referencia.

Este asistente mantiene una conversación privada independiente de hasta 100 entradas guardadas y 3 MiB. Introduzca una pregunta de hasta 12,000 caracteres; Enviar la formula, Detener cancela la respuesta activa conservando su pregunta disponible y Borrar elimina esta conversación de Ayuda. El borrador no enviado y la selección de ajuste preestablecido persisten al cerrar o reabrir la Ayuda en la misma sesión de la aplicación, pero el borrador no se guarda en el disco. El asistente no envía comandos de la aplicación, no modifica un flujo de trabajo ni aprueba una puerta de control. El asesoramiento no constituye una verificación en vivo de una tarea, cuenta o conexión externa.

Las sesiones de Ayuda de Claude Code y de la API aplican la política admitida de no usar herramientas. Las sesiones nativas de Ayuda de Codex y Antigravity requieren el permiso nativo existente de equipo del propietario local. Si está deshabilitado, la aplicación explica el requisito previo en lugar de elegir un proveedor diferente. Solo el propietario puede habilitarlo en la configuración de control local; el asistente no puede habilitarlo por sí mismo.

La Ayuda con Codex utiliza un entorno de pruebas de solo lectura y rechaza solicitudes de aprobación de herramientas. Antigravity utiliza el modo de plan y su indicador de entorno de pruebas nativo. Estos modos nativos no constituyen una garantía universal de confinamiento en el sistema operativo. El hash de la guía de origen identifica la referencia empleada para la respuesta; aun así, una explicación generada puede contener errores, por lo que debe inspeccionar las secciones vinculadas antes de actuar. Las respuestas anteriores se marcan cuando su versión de la guía de origen difiere de la actual.

Instrucciones relacionadas: [Mantenimiento de la guía canónica y de las traducciones](../../HELP_MAINTENANCE.md) · [Asistente de la aplicación y permisos](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## Asistente y Telegram

El asistente utiliza el ajuste preestablecido seleccionado y el mismo API de control de la aplicación. El permiso para inspeccionar el estado y el permiso para realizar operaciones son independientes. Inspeccione los comandos y los resultados: la redacción del asistente no es una prueba de que una acción se haya completado.

Telegram solo puede ser habilitado por el propietario local, con un token de bot existente y un ID numérico del propietario. El control es para el chat privado de ese propietario. Un bot no configurado o inactivo no debe recibir mensajes de la aplicación.

No pegue un token de bot en un chat ordinario. Configurar la integración no demuestra la conectividad con Telegram y no crea automáticamente un bot. Las capturas de pantalla y las respuestas pueden contener datos privados del espacio de trabajo.

Seleccione un ajuste preestablecido del asistente y otorgue el permiso de operación de la aplicación por separado del de inspección. La ejecución del asistente con Codex y Antigravity requiere el permiso nativo del propietario; no se sustituyen silenciosamente por una sesión de API o Claude sin herramientas. Se pueden mostrar capturas de pantalla en la conversación del asistente, pero la entrada del modelo actual no incluye análisis de imágenes. No asuma que el asistente inspeccionó visualmente una imagen solo porque la mostró.

El asistente puede inspeccionar resúmenes, tareas, chats, el estado del flujo de trabajo, el contexto del proceso y las ventanas de la aplicación mediante herramientas con tipos. Puede cambiar las configuraciones ordinarias permitidas e iniciar operaciones autorizadas de la aplicación. No puede otorgar permisos nativos, revelar credenciales almacenadas, modificar remotamente la concesión del espacio de trabajo raíz ni aprobar una puerta de control de Forge simplemente por conveniencia.

Instrucciones relacionadas: [Contrato de control de la aplicación](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## Operar su bot privado de Telegram

Cree u obtenga su propio bot, inicie su chat privado e introduzca su token y su ID numérico de usuario de Telegram en los ajustes de control local. Habilite la integración solo cuando desee que la aplicación se conecte. El ID del propietario es un identificador de usuario, no un nombre de usuario ni el ID del bot. Solo se aceptan los mensajes de ese usuario en ese mismo chat privado.

Utilice /start, /menu o /status para obtener una vista general de la versión en ejecución, el recuento de proyectos/tareas y los estados de las tareas. Los botones abren Proyectos, Tareas, Captura de pantalla, Ayuda e Idioma. Las listas muestran ocho elementos por página, con navegación hacia Atrás, Actualizar, Inicio y Anterior/Siguiente. Los botones de proyecto filtran la lista de tareas. Una tarjeta de tarea muestra el progreso guardado de su flujo de trabajo, el modelo/ajuste preestablecido y las preguntas pendientes cuando las haya.

Abra los Chats de una tarea para previsualizar conversaciones abiertas/recientes y chats de fases del flujo de trabajo. Cada vista previa muestra hasta seis de los últimos mensajes de usuario/asistente, acortados visiblemente a 200 caracteres cada uno. El razonamiento privado no se muestra. Leer el historial no inicia un proveedor. Las vistas previas son de solo lectura: el texto ordinario y /ask TEXT continúan dirigiéndose al asistente de la aplicación, nunca implícitamente al chat de la tarea que está visualizando.

Ejecutar / Continuar vuelve a leer el flujo de trabajo actual de Code o Work e inicia un flujo de trabajo apto guardado. Pausar solicita su pausa. Ninguno de los dos acepta requisitos, una especificación, un plan, hallazgos de revisión o preguntas; una decisión pendiente impide la ejecución. Tome decisiones en la aplicación o utilice un comando con tipos explícitamente autorizado con su puerta de control y revisión actuales exactas.

Utilice Idioma o /language para seleccionar cualquiera de los 56 idiomas de la interfaz por su nombre nativo. Esto guarda una preferencia únicamente para este bot y propietario. Usar idioma de la aplicación borra esa preferencia. No cambia el idioma de la aplicación ni los permisos de acceso; los mensajes existentes no se reenvían automáticamente.

La navegación normalmente actualiza el mismo mensaje de menú publicado. Los botones tienen identificadores opacos que caducan a los 15 minutos y pueden usarse una sola vez; cambiar una tarjeta invalida sus botones anteriores. Los botones caducados, consumidos, de mensajes no coincidentes y de procesos anteriores no pueden realizar ninguna acción. Un mensaje definitivamente no editable puede reemplazarse por una nueva tarjeta; un error de red desconocido no se reintenta como un mensaje nuevo.

Al activarse, el poller descarta los mensajes acumulados anteriores y registra la aceptación de actualizaciones antes del despacho, de modo que los comandos interrumpidos no se reproduzcan automáticamente al reiniciar. Esto evita la repetición; no garantiza la finalización. Compruebe el estado/contexto antes de emitir deliberadamente nuevo trabajo tras un error. No hay notificaciones automáticas del estado de las tareas.

Los comandos explícitos siguen disponibles: /projects, /tasks, /task TASK_ID, /run TASK_ID, /pause TASK_ID, /screenshot y /ask TEXT. /new {JSON} crea una tarea a través de createTask con tipos; /command {JSON} envía un comando explícito del catálogo. Consulte el catálogo en vivo para conocer las estructuras de argumentos. Se aplican las mismas autorizaciones de backend y concesiones de carpetas que en la aplicación.

La aplicación nunca envía valores de tokens de bot almacenados al asistente. No obstante, las capturas de pantalla, los resúmenes y el texto de las conversaciones pueden contener información privada del proyecto. Detenga la integración localmente si el bot o la cuenta del propietario ya no son de confianza. Rote un token filtrado con el proveedor del bot y luego actualice su configuración cifrada local.

Instrucciones relacionadas: [Bot privado y comandos](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## Permiso nativo de equipo exclusivo del propietario

El acceso nativo al equipo comienza deshabilitado. Solo el propietario puede habilitarlo en Ajustes locales → Control remoto. El asistente y los comandos HTTP/MCP/Telegram no pueden habilitar este indicador por sí mismos. Si se deniega una operación, el asistente debe describir la configuración y dejar que el propietario decida.

Cuando se habilita explícitamente, computer.run acepta un ejecutable, una matriz de argumentos y un directorio de trabajo absoluto opcional. No utiliza interpolación de shell, tiene un límite de 30 segundos y acota la salida a 1 MiB. Si se proporciona un directorio inexistente o no válido, se rechaza; omitir el cwd utiliza el directorio de configuración propiedad de la aplicación, no HOME. Salir cancela los comandos activos que le pertenecen y espera la limpieza de sus procesos.

El alcance de lectura/operación de la aplicación y el acceso nativo son decisiones independientes. Un árbol de trabajo no restringe el acceso al sistema de archivos de un proveedor sin restricciones. Revoque el acceso nativo tras la tarea si ya no es necesario e inspeccione los comprobantes de comandos en lugar de aceptar la redacción del asistente como prueba.

Instrucciones relacionadas: [Contrato de control exclusivo del propietario](../../../shared/control.ts).

<a id="remote"></a>

## Navegador e instancias remotas

El propietario local habilita el servidor y elige su dirección, puerto y alcance: leer para inspección u operar para acciones. La dirección predeterminada 127.0.0.1 solo está disponible en este equipo. 0.0.0.0 escucha en interfaces de red; revise el acceso a la red antes de habilitarlo.

Un navegador abre la misma interfaz tras iniciar sesión con un token. No incluya tokens en enlaces públicos ni en capturas de pantalla. HTTP por sí solo no cifra el tráfico; utilice un canal protegido en una red no confiable.

El propietario configura otras instancias mediante URL y token. El backend actúa como proxy de las solicitudes; esto no copia sus proyectos en la máquina local. Compruebe la instancia seleccionada antes de cada acción.

Los comandos y eventos con tipos gestionan el control de la aplicación. El alcance de lectura no autoriza modificaciones de tareas. El control nativo del equipo es una elección independiente del propietario local y comienza deshabilitado.

La aplicación debe permanecer en ejecución para el control del navegador, Telegram y agentes externos. Cada instancia tiene su propio perfil privado, estado de tarea, token y puerto de servidor. No reutilice un mismo perfil simultáneamente entre instancias independientes. Los eventos del navegador y las respuestas a comandos están limitados a la instancia seleccionada; cambiar el UI no reubica archivos ni copia el inicio de sesión nativo.

Instrucciones relacionadas: [Control de instancias y HTTP](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw, Hermes y otros agentes externos

Utilice el API autenticado de control de la aplicación o el puente stdio MCP integrado. Habilite el servidor localmente, elija leer u operar y configure cada cliente con el URL y el token de esa instancia. Se requiere Node.js 22 o más reciente para ejecutar el puente MCP independiente; la aplicación Electron no instala su cliente de agente. El URL del navegador no es un punto de conexión de HTTP MCP con capacidad de streaming: proporciónelo como ZIAFORGE_URL al puente stdio.

El puente expone ziaforge_status, ziaforge_commands, ziaforge_command y ziaforge_screenshot. Comience con el estado y el catálogo de comandos activos, luego lea system.context para la tarea seleccionada. Los comandos con tipos siguen las mismas comprobaciones de revisión, puertas de control, carpetas de tareas y limpieza que el UI local.

El catálogo de comandos activos incluye documentation.guide, la ayuda canónica en inglés, con su ruta de origen y sourceSha256. El arquitecto interno de la aplicación recibe la misma referencia a través de sus herramientas. Esto proporciona a los agentes el contexto completo del producto sin depender de notas antiguas; la documentación nunca otorga acceso ni sustituye una decisión humana actual.

Los agentes deben debatir los requisitos, las decisiones técnicas y la planificación a partir de una breve idea humana. Deben respetar las puertas de control humanas explícitas, los modelos seleccionados, la directiva manual/Auto y la revisión requerida. No deben inventar aprobaciones, reintentar comandos inciertos bajo un nuevo ID ni publicar cambios de Git sin la intención del propietario.

Configure varios servidores MCP con nombre para diferentes instalaciones. Cambiar de instancia es una decisión de enrutamiento, no de sincronización. Los ejemplos de configuración de OpenClaw y Hermes se encuentran en AGENT_CONTROL.md; la configuración específica del cliente y la compatibilidad deben verificarse para la versión instalada del cliente.

La caché externa de requestId solo desduplica un conjunto acotado de solicitudes mientras la aplicación está en ejecución. Las operaciones duraderas utilizan sus propios identificadores: createRequestId para la creación de tareas, commandId para decisiones de flujo de trabajo, clientMessageId para mensajes y operationId para mutaciones de Git. Conserve el identificador y la carga útil originales tras una confirmación desconocida; lea el estado guardado antes de emitir deliberadamente nuevo trabajo.

Instrucciones relacionadas: [Instrucciones para clientes de MCP](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## CLI local y límites de automatización

El despachador ziaf controla la misma aplicación en ejecución y el flujo de trabajo guardado. Desde el código fuente, utilice npm run ziaf -- list, npm run ziaf -- status --task TASK_ID --json, npm run ziaf -- start --task TASK_ID o npm run ziaf -- pause --task TASK_ID. Un acuse de recibo de Inicio correcto no significa que la tarea se haya completado.

--until-success habilita deliberadamente Auto para el flujo de trabajo guardado, pero las preguntas, la revisión, las puertas de control de aceptación, los límites y los puntos de control siguen aplicándose. Ctrl+C sale del despachador de observación; no detiene implícitamente el flujo de trabajo de la aplicación. Consulte CLI.md para el tratamiento de códigos de salida, punto de conexión local y perfiles.

La interfaz de Automatizaciones actualmente almacena definiciones de visualización y contadores de ejecuciones locales. No es un programador periódico certificado ni demuestra que se haya ejecutado un turno de modelo en segundo plano. Para una ejecución real, utilice los controles del flujo de trabajo guardado, ziaf o el API autenticado e inspeccione sus comprobantes. No confunda el panel de demostración con una programación desatendida.

Instrucciones relacionadas: [Comandos del despachador](../../CLI.md).

<a id="updates"></a>

## Versión y actualizaciones

Acerca de muestra la versión exacta en ejecución. Las actualizaciones públicas requieren un repositorio de versiones GitHub confiable y un canal estable o de vista previa. La comprobación, la descarga y la instalación tienen estados independientes; un error no significa que se haya instalado una actualización.

La instalación automática es para versiones firmadas de macOS. Las compilaciones de desarrollo no firmadas no se instalan automáticamente mediante este mecanismo. Para un reemplazo manual, cierre por completo la aplicación actual y utilice un artefacto verificado.

La comprobación automática se ejecuta inmediatamente cuando se habilita, y luego cada seis horas.

Estable excluye las versiones de vista previa; vista previa también permite versiones de desarrollo. Una comprobación exitosa solo establece los metadatos de la versión disponible. La descarga y la instalación requieren el paquete de la plataforma y el canal de versiones configurado. La entrega de Linux DEB es una ruta de instalación independiente; no asuma que un DEB se actualiza automáticamente mediante el mecanismo de actualización de macOS.

Instrucciones relacionadas: [Preparación de versiones](../../RELEASE_READINESS.md).

<a id="restart"></a>

## Reinicio y recuperación

En macOS, utilice Salir / ⌘Q para un cierre completo. Cerrar la ventana puede dejar la aplicación en ejecución. Cierre por completo la versión anterior antes de reemplazar la aplicación.

Tras el inicio, seleccione la misma tarea. Se restablecen el historial y los borradores. Reanudar restaura un contexto nativo/local, pero no envía un borrador, no reanuda la cola ni autoriza a repetir una operación desconocida.

Si aparece Recuperación, no edite JSON a mano. Inspeccione el tipo de documento afectado, conserve los archivos originales y seleccione una copia de seguridad validada. Restaurar una cola anterior marca sus elementos como inciertos.

Cuando el resultado de una entrega es desconocido, un flujo de trabajo gestionado puede requerir permiso explícito para un contexto nuevo. El trabajo anterior y los intentos fallidos permanecen; un rechazo visible es más seguro que un éxito fabricado.

Haga una copia de seguridad de los archivos de tareas y del perfil de la aplicación con todas las instancias cerradas. Una carpeta copiada no es una restauración probada. Si la recuperación le solicita seleccionar una copia de seguridad validada, conserve también los archivos dañados exactos. Restaurar un flujo de trabajo o una cola anteriores no autoriza a reintentar inferencias inciertas u operaciones de Git.

Instrucciones relacionadas: [Contrato de recuperación](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## Solución de problemas

CLI no encontrado: verifique su instalación y versión en una terminal ordinaria, luego reinicie ZIAForge. Que un ejecutable esté presente no significa que haya iniciado sesión. Utilice el mecanismo de inicio de sesión propio del proveedor.

Modelo no disponible o error de autorización: actualice el descubrimiento, seleccione un ID disponible y revise su cuenta y límites. No repita una solicitud incierta antes de inspeccionar su historial.

Flujo de trabajo detenido: abra la fase actual, la pregunta, el comprobante de verificación o los registros de CLI. Aborde la causa específica: una pregunta sin responder, un comando, el permiso de una carpeta o el límite de intentos. Continuar no puede convertir una comprobación fallida en un éxito.

Carpeta faltante o reemplazada: restaure el acceso a la carpeta original o cree una nueva tarea. La aplicación no debe continuar desde HOME. Si observa otro cwd, detenga el turno y conserve los diagnósticos.

Para enviar un informe, incluya la versión de Acerca de, la ruta, el CLI/modelo, el comportamiento esperado y el real, una captura de pantalla y un extracto seguro de los registros. Elimine secretos, contenido personal y rutas que no puedan publicarse.

Página remota no disponible: verifique que el propietario haya habilitado el servidor, compruebe la dirección de escucha y el puerto, y luego autentíquese con el token de instancia correcto. Un 401 indica autenticación; una mutación denegada puede deberse al alcance de lectura o a un control exclusivo del propietario. Cambiar el token cierra los clientes de navegador existentes. No exponga el puerto de inspección independiente de DevTools como control remoto de la aplicación.

Guardado en el editor rechazado: conserve el borrador, inspeccione el archivo actual en disco y resuelva el conflicto de cambios externos. No eluda la comparación reescribiendo los metadatos de la aplicación. Si la carga completa de archivos grandes no está disponible, utilice la edición/búsqueda por ventanas admitida o un editor externo.

Telegram no disponible: confirme localmente el token del bot, el propietario numérico, el chat privado y el estado. Un webhook o poller competidor puede bloquear el sondeo; ZIAForge no elimina automáticamente un webhook ni toma el control de otro poller. Los comandos rechazados o interrumpidos en un límite desconocido no se reproducen automáticamente.

Instrucciones relacionadas: [Pruebas y diagnóstico](../../TESTING.md).

<a id="diagnostics"></a>

## Informar problemas e inspeccionar evidencias

Registre la compilación exacta en ejecución desde Acerca de, OS/arquitectura, el modo de tarea, el proveedor/modelo seleccionado y los pasos para reproducir el problema. Describa el resultado esperado y el resultado observado. Incluya una captura de pantalla segura y el comprobante de verificación o comando retenido correspondiente, en lugar de un perfil privado completo.

Los registros de CLI, los diarios de eventos, las transcripciones de modelos, las trazas del navegador y las capturas de pantalla pueden exponer código fuente, rutas personales o tokens. Inspeccione y censure la información confidencial antes de compartirla. Un censor de registros basado en el mejor esfuerzo no certifica que una captura de pantalla o un archivo sean publicables.

Para los colaboradores, qa:doctor lee la identidad del entorno/compilación; qa:inspect abre un perfil aislado con stubs de proveedores. Un fixture valida la ruta probada de la aplicación sin comunicarse con un modelo. La inferencia en vivo, la conectividad con Telegram, el escritorio nativo Linux, la firma y las comprobaciones de artefactos empaquetados constituyen evidencias separadas. Consulte TESTING.md para conocer los comandos reproducibles y la limpieza.

Instrucciones relacionadas: [Comandos de evidencia](../../TESTING.md).

<a id="privacy"></a>

## Datos locales y límites

Los proyectos, el historial, los planes, los documentos y los diagnósticos pueden contener texto privado. No publique perfiles, capturas sin procesar, claves ni registros completos junto con el código fuente.

En Linux, guardar credenciales de API, control, Telegram y de instancias requiere un servicio de secretos GNOME desbloqueado o KWallet; sin un almacén de secretos compatible, ZIAForge se niega a guardar estos secretos en lugar de recurrir a la alternativa basic_text de Electron.

El almacenamiento local no significa que las solicitudes permanezcan en su equipo: el CLI/API seleccionado las envía a su proveedor. Una carpeta de trabajo y la supervisión de procesos no constituyen aislamiento de OS. Inspeccione los permisos seleccionados.

Distinga los tipos de evidencia: los fixtures prueban la aplicación sin un modelo; las pruebas nativas en vivo evalúan una cuenta/CLI real; las comprobaciones empaquetadas certifican un artefacto específico. Superar una no garantiza las demás.

El alcance de la aplicación, un árbol de trabajo y una instrucción de solo lectura son distintos de la imposición a nivel del sistema operativo. Las directivas de revisor/asistente de Antigravity detectan cambios en las evidencias recopiladas del espacio de trabajo en lugar de imponer el acceso de solo lectura en el sistema de archivos. El control nativo del equipo ejecuta programas autorizados por el propietario fuera del límite habitual de herramientas de la aplicación; desactívelo cuando ya no sea necesario.

Instrucciones relacionadas: [Procedencia y publicación](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## Comprender y modificar este proyecto de código abierto

Lea AGENTS.md y CONTRIBUTING.md primero, luego PROJECT_MAP.md para conocer los límites actuales del código fuente. Los contratos con tipos implementados y los documentos actuales de flujos de trabajo/proveedores rigen el comportamiento. CONCEPT.md y las partes orientadas a terminal de ARCHITECTURE.md conservan la intención histórica y no deben confundirse con afirmaciones de la versión actual.

La fuente de ayuda en inglés es docs/help/en.json. No edite manualmente los archivos generados USER_GUIDE.md o website/guide.html. Modifique la sección canónica, actualice el contrato afectado y ejecute node scripts/help/generate.cjs. La Ayuda integrada en la aplicación lee la misma fuente. Revise las incorporaciones con la implementación real, incluidos los límites, los permisos y las rutas no compatibles.

Cada una de las 56 configuraciones regionales de la interfaz tiene un estado de ayuda independiente en docs/help/locales.json. La ayuda faltante o incompleta recurre al inglés. Los textos completos traducidos automáticamente se etiquetan y se vinculan al hash de origen en inglés, sin afirmar que cuenten con revisión humana. Una traducción con revisión humana registra adicionalmente a su revisor. Toda traducción debe conservar los identificadores de sección, las acciones, los identificadores de archivos/comandos y los límites técnicos, utilizar la dirección de texto correcta y actualizarse cuando cambie su fuente en inglés.

Antes del lanzamiento, ejecute node scripts/help/generate.cjs --check para detectar salidas generadas desactualizadas, estructuras regionales no válidas o enlaces de contratos locales rotos. Las comprobaciones de traducción de UI y las comprobaciones de comportamiento de la aplicación permanecen separadas. HELP_MAINTENANCE.md proporciona el procedimiento de actualización para colaboradores y AI; la documentación no debe afirmar que se superó una prueba que no se ha ejecutado.

Instrucciones relacionadas: [Mapa actual del proyecto](../../PROJECT_MAP.md) · [Mantenimiento de la documentación](../../HELP_MAINTENANCE.md) · [Instrucciones para colaboradores](../../../CONTRIBUTING.md) · [Instrucciones para agentes](../../../AGENTS.md).
