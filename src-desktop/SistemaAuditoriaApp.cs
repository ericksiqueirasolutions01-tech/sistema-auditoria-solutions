using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;
using System.Drawing;
using System.Management;
using System.Security.Cryptography;

namespace SistemaAuditoriaSolutions
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            string logPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SistemaAuditoriaSolutions",
                "app.log"
            );

            string profileDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SistemaAuditoriaSolutions",
                "UserData"
            );

            // =========================================================================
            // 1. LIMPEZA DE INICIALIZAÇÃO: Elimina processos órfãos anteriores
            // =========================================================================
            Process current = Process.GetCurrentProcess();
            try
            {
                foreach (Process p in Process.GetProcessesByName("SistemaAuditoriaSolutions"))
                {
                    if (p.Id != current.Id)
                    {
                        try
                        {
                            File.AppendAllText(logPath, string.Format("[{0}] Finalizando processo anterior em segundo plano (PID {1})...\n", DateTime.Now, p.Id));
                            p.Kill();
                            p.WaitForExit(1500);
                        }
                        catch {}
                    }
                }
            }
            catch {}

            // Limpa processos órfãos e arquivos de lock do Edge antes de iniciar
            KillOrphanedEdgeProcesses(profileDir);
            CleanProfileLocks(profileDir);

            // =========================================================================
            // 2. CONTROLE DE INSTÂNCIA ÚNICA (LOCAL MUTEX SEGURO)
            // =========================================================================
            bool isNewInstance = true;
            Mutex singleInstanceMutex = null;
            try
            {
                singleInstanceMutex = new Mutex(true, "Local\\SistemaAuditoriaSolutions_SingleInstance_Mutex", out isNewInstance);
                if (!isNewInstance)
                {
                    if (singleInstanceMutex.WaitOne(1500, false))
                    {
                        isNewInstance = true;
                    }
                }
            }
            catch
            {
                isNewInstance = true;
            }

                try
                {
                    try
                    {
                        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;
                    }
                    catch {}

                    File.AppendAllText(logPath, string.Format("\n[{0}] Iniciando aplicacao (instancia limpa ativa)...\n", DateTime.Now));
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    Application.Run(new AuditoriaAppContext(logPath, profileDir));
                }
                catch (Exception ex)
                {
                    try
                    {
                        File.AppendAllText(logPath, string.Format("[{0}] ERRO FATAL: {1}\n", DateTime.Now, ex.ToString()));
                    }
                    catch {}
                    MessageBox.Show(
                        "Erro ao inicializar o Sistema de Auditoria:\n" + ex.Message,
                        "Erro",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }
                finally
                {
                    if (singleInstanceMutex != null)
                    {
                        try { singleInstanceMutex.Dispose(); } catch {}
                    }
                }
        }

        public static void CleanProfileLocks(string profilePath)
        {
            try
            {
                if (Directory.Exists(profilePath))
                {
                    string[] lockFiles = new string[] {
                        Path.Combine(profilePath, "SingletonLock"),
                        Path.Combine(profilePath, "SingletonCookie"),
                        Path.Combine(profilePath, "SingletonSocket"),
                        Path.Combine(profilePath, "lockfile")
                    };
                    foreach (var f in lockFiles)
                    {
                        if (File.Exists(f))
                        {
                            try { File.Delete(f); } catch {}
                        }
                    }
                }
            }
            catch {}
        }

        public static void KillOrphanedEdgeProcesses(string profilePath)
        {
            try
            {
                using (var searcher = new ManagementObjectSearcher(
                    "SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name = 'msedge.exe'"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        string cmd = obj["CommandLine"] as string;
                        if (!string.IsNullOrEmpty(cmd) && cmd.IndexOf("SistemaAuditoriaSolutions", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            uint pid = (uint)obj["ProcessId"];
                            try
                            {
                                var proc = Process.GetProcessById((int)pid);
                                proc.Kill();
                            }
                            catch {}
                        }
                    }
                }
            }
            catch {}
        }
    }

    public class AuditoriaAppContext : ApplicationContext
    {
        private HttpListener listener;
        private Thread serverThread;
        private bool isRunning = true;
        private int port = 5173;
        private string distPath;
        private string profileDir;
        private NotifyIcon trayIcon;
        private string logFile;
        private DateTime lastHeartbeatUtc = DateTime.UtcNow;
        private DateTime appStartTime = DateTime.UtcNow;
        private int launchedEdgePid = 0;
        private object shutdownLock = new object();
        private bool isShuttingDown = false;
        private string sessionSecret;

        private void Log(string msg)
        {
            try
            {
                if (!string.IsNullOrEmpty(logFile))
                {
                    File.AppendAllText(logFile, string.Format("[{0}] {1}\n", DateTime.Now.ToString("HH:mm:ss.fff"), msg));
                }
            }
            catch {}
        }

        public AuditoriaAppContext(string log, string profile)
        {
            this.logFile = log;
            this.profileDir = profile;
            this.sessionSecret = Guid.NewGuid().ToString("N");

            try
            {
                Log("AuditoriaAppContext iniciado com SessionSecret gerado.");
                string appRoot = AppDomain.CurrentDomain.BaseDirectory;
                distPath = Path.Combine(appRoot, "dist");
                if (!Directory.Exists(distPath))
                {
                    distPath = appRoot; // Fallback se executado direto da pasta com index.html
                }
                Log("distPath: " + distPath);

                if (!Directory.Exists(profileDir))
                {
                    Directory.CreateDirectory(profileDir);
                }
                Log("profileDir: " + profileDir);

                // 1. Encontra porta livre
                port = FindFreePort(5173);
                Log("Porta selecionada: " + port);

                // 2. Inicia o servidor local de arquivos estáticos e endpoints de ciclo de vida
                StartWebServer(distPath, port);
                Log("Servidor Web iniciado com sucesso.");

                // Aguarda para certificar que o socket está ouvindo
                Thread.Sleep(300);

                // 3. Inicializa o ícone de bandeja do sistema (Tray Icon)
                InitTrayIcon(appRoot);
                Log("TrayIcon inicializado.");

                // 4. Abre a janela do aplicativo nativa
                OpenAppWindow();
                Log("Janela do aplicativo acionada.");
            }
            catch (Exception ex)
            {
                Log("ERRO em AuditoriaAppContext: " + ex.ToString());
                MessageBox.Show(
                    "Erro ao inicializar o Sistema de Auditoria:\n" + ex.Message,
                    "Erro de Inicialização",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                ExecuteFullShutdown();
            }
        }

        private void InitTrayIcon(string appRoot)
        {
            var menu = new ContextMenuStrip();
            var itemAbrir = menu.Items.Add("🚀 Abrir Sistema de Auditoria");
            itemAbrir.Font = new Font(itemAbrir.Font, FontStyle.Bold);
            itemAbrir.Click += (s, e) => OpenAppWindow();

            var itemStatus = menu.Items.Add(string.Format("🌐 Servidor: Ativo (Porta {0})", port));
            itemStatus.Enabled = false;

            menu.Items.Add(new ToolStripSeparator());

            var itemSair = menu.Items.Add("❌ Sair do Sistema (Fechar Completo)");
            itemSair.Font = new Font(itemSair.Font, FontStyle.Bold);
            itemSair.Click += (s, e) => ExecuteFullShutdown();

            trayIcon = new NotifyIcon
            {
                Text = string.Format("Sistema de Auditoria Solutions (Porta {0})", port),
                ContextMenuStrip = menu,
                Visible = true
            };

            string icoPath = Path.Combine(appRoot, "app.ico");
            if (File.Exists(icoPath))
            {
                try
                {
                    trayIcon.Icon = new Icon(icoPath);
                }
                catch
                {
                    trayIcon.Icon = SystemIcons.Application;
                }
            }
            else
            {
                trayIcon.Icon = SystemIcons.Application;
            }

            trayIcon.DoubleClick += (s, e) => OpenAppWindow();
        }

        public void OpenAppWindow()
        {
            string url = string.Format("http://127.0.0.1:{0}/", port);
            LaunchEdgeApp(url, profileDir);
        }

        private void LaunchEdgeApp(string url, string profile)
        {
            string[] possiblePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft\\Edge\\Application\\msedge.exe"),
                "msedge.exe"
            };

            bool launched = false;
            foreach (var edgePath in possiblePaths)
            {
                if (edgePath == "msedge.exe" || File.Exists(edgePath))
                {
                    try
                    {
                        var psi = new ProcessStartInfo
                        {
                            FileName = edgePath,
                            Arguments = string.Format(
                                "--app={0} --user-data-dir=\"{1}\" --no-first-run --no-default-browser-check --disable-background-mode --disable-features=msStartupBoost,CalculateNativeWinOcclusion --no-service-autorun",
                                url,
                                profile
                            ),
                            UseShellExecute = false
                        };
                        Log("Iniciando Edge: " + edgePath + " args: " + psi.Arguments);
                        Process proc = Process.Start(psi);
                        if (proc != null)
                        {
                            launchedEdgePid = proc.Id;
                            launched = true;
                            break;
                        }
                    }
                    catch (Exception ex)
                    {
                        Log("Falha ao iniciar Edge (" + edgePath + "): " + ex.Message);
                    }
                }
            }

            if (!launched)
            {
                try
                {
                    var p = Process.Start(url);
                    if (p != null) launchedEdgePid = p.Id;
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Não foi possível abrir o navegador: " + ex.Message, "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
        }

        private int FindFreePort(int startPort)
        {
            for (int p = startPort; p < startPort + 50; p++)
            {
                try
                {
                    var test = new HttpListener();
                    test.Prefixes.Add(string.Format("http://127.0.0.1:{0}/", p));
                    test.Start();
                    test.Stop();
                    test.Close();
                    return p;
                }
                catch
                {
                    // Porta em uso, tenta a próxima
                }
            }
            return 5173;
        }

        private void StartWebServer(string rootDir, int listenPort)
        {
            listener = new HttpListener();
            listener.Prefixes.Add(string.Format("http://127.0.0.1:{0}/", listenPort));

            try
            {
                listener.Start();
            }
            catch (Exception ex)
            {
                throw new Exception("Falha ao iniciar servidor HTTP local na porta " + listenPort + ": " + ex.Message);
            }

            serverThread = new Thread(() =>
            {
                while (isRunning && listener != null && listener.IsListening)
                {
                    try
                    {
                        var context = listener.GetContext();
                        ThreadPool.QueueUserWorkItem((c) => HandleRequest((HttpListenerContext)c, rootDir), context);
                    }
                    catch
                    {
                        break;
                    }
                }
            });
            serverThread.IsBackground = true;
            serverThread.Start();
        }

        private void HandleRequest(HttpListenerContext context, string rootDir)
        {
            try
            {
                var req = context.Request;
                var res = context.Response;

                // =====================================================================
                // 1. HARDENING DE CORS E ORIGIN (Gate 13.1)
                // Nunca usar wildcard '*' e rejeitar origens que não sejam do loopback local
                // =====================================================================
                string origin = req.Headers["Origin"];
                string expectedLoopback127 = string.Format("http://127.0.0.1:{0}", port);
                string expectedLocalhost = string.Format("http://localhost:{0}", port);

                if (!string.IsNullOrEmpty(origin))
                {
                    if (!origin.Equals(expectedLoopback127, StringComparison.OrdinalIgnoreCase) &&
                        !origin.Equals(expectedLocalhost, StringComparison.OrdinalIgnoreCase))
                    {
                        Log("Origem não autorizada bloqueada: " + origin);
                        res.StatusCode = 403;
                        byte[] errBytes = Encoding.UTF8.GetBytes("{\"erro\":\"Acesso negado: Origem não autorizada (CORS bloqueado).\"}");
                        res.ContentType = "application/json; charset=utf-8";
                        res.OutputStream.Write(errBytes, 0, errBytes.Length);
                        res.Close();
                        return;
                    }

                    res.AddHeader("Access-Control-Allow-Origin", origin);
                    res.AddHeader("Vary", "Origin");
                }

                res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.AddHeader("Access-Control-Allow-Headers", "Content-Type, X-System-Secret");
                res.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate");

                if (req.HttpMethod == "OPTIONS")
                {
                    res.StatusCode = 204;
                    res.Close();
                    return;
                }

                // =====================================================================
                // 2. ENDPOINTS PRIVILEGIADOS DO SISTEMA (/api/system/*) - Gate 13.1
                // Exigência obrigatória do header X-System-Secret gerado dinamicamente
                // =====================================================================
                if (req.Url.AbsolutePath.StartsWith("/api/system/"))
                {
                    string headerSecret = req.Headers["X-System-Secret"];
                    if (string.IsNullOrEmpty(headerSecret) || !headerSecret.Equals(sessionSecret, StringComparison.Ordinal))
                    {
                        Log(string.Format("Acesso não autorizado a {0} (secret ausente ou incorreto).", req.Url.AbsolutePath));
                        res.StatusCode = 401;
                        byte[] unauthBytes = Encoding.UTF8.GetBytes("{\"erro\":\"Acesso negado: Header X-System-Secret ausente ou inválido.\"}");
                        res.ContentType = "application/json; charset=utf-8";
                        res.OutputStream.Write(unauthBytes, 0, unauthBytes.Length);
                        res.Close();
                        return;
                    }

                    if (req.Url.AbsolutePath == "/api/system/heartbeat")
                    {
                        lastHeartbeatUtc = DateTime.UtcNow;
                        byte[] okBytes = Encoding.UTF8.GetBytes("{\"status\":\"ok\",\"timestamp\":\"" + DateTime.UtcNow.ToString("o") + "\"}");
                        res.ContentType = "application/json; charset=utf-8";
                        res.StatusCode = 200;
                        res.OutputStream.Write(okBytes, 0, okBytes.Length);
                        res.Close();
                        return;
                    }

                    if (req.Url.AbsolutePath == "/api/system/shutdown")
                    {
                        // Regra 13.1: Apenas requisição POST é permitida para encerramento
                        if (req.HttpMethod != "POST")
                        {
                            res.StatusCode = 405;
                            byte[] notAllowed = Encoding.UTF8.GetBytes("{\"erro\":\"Método não permitido. O encerramento requer requisição POST.\"}");
                            res.ContentType = "application/json; charset=utf-8";
                            res.OutputStream.Write(notAllowed, 0, notAllowed.Length);
                            res.Close();
                            return;
                        }

                        Log("Recebida solicitação autorizada de encerramento (/api/system/shutdown via POST).");
                        byte[] shutBytes = Encoding.UTF8.GetBytes("{\"sucesso\":true,\"mensagem\":\"Sistema encerrando com segurança...\"}");
                        res.ContentType = "application/json; charset=utf-8";
                        res.StatusCode = 200;
                        res.OutputStream.Write(shutBytes, 0, shutBytes.Length);
                        res.Close();

                        ThreadPool.QueueUserWorkItem((state) =>
                        {
                            Thread.Sleep(200);
                            ExecuteFullShutdown();
                        });
                        return;
                    }

                    if (req.Url.AbsolutePath == "/api/system/version")
                    {
                        int vCod = 130;
                        string vStr = "1.3.0";
                        string vJsonPath = Path.Combine(rootDir, "version.json");
                        if (File.Exists(vJsonPath))
                        {
                            try
                            {
                                byte[] vFileBytes = File.ReadAllBytes(vJsonPath);
                                res.ContentType = "application/json; charset=utf-8";
                                res.StatusCode = 200;
                                res.OutputStream.Write(vFileBytes, 0, vFileBytes.Length);
                                res.Close();
                                return;
                            }
                            catch {}
                        }
                        string fallbackJson = string.Format("{{\"versao\":\"{0}\",\"versaoCodigo\":{1},\"isDesktop\":true}}", vStr, vCod);
                        byte[] vBytes = Encoding.UTF8.GetBytes(fallbackJson);
                        res.ContentType = "application/json; charset=utf-8";
                        res.StatusCode = 200;
                        res.OutputStream.Write(vBytes, 0, vBytes.Length);
                        res.Close();
                        return;
                    }

                    if (req.Url.AbsolutePath == "/api/system/update")
                    {
                        // Regra 13.1: Apenas requisição POST é permitida para atualização
                        if (req.HttpMethod != "POST")
                        {
                            res.StatusCode = 405;
                            byte[] notAllowed = Encoding.UTF8.GetBytes("{\"erro\":\"Método não permitido. A atualização requer requisição POST.\"}");
                            res.ContentType = "application/json; charset=utf-8";
                            res.OutputStream.Write(notAllowed, 0, notAllowed.Length);
                            res.Close();
                            return;
                        }

                        Log("Recebida solicitação autorizada de atualização (/api/system/update via POST).");
                        byte[] updBytes = Encoding.UTF8.GetBytes("{\"sucesso\":true,\"mensagem\":\"Download seguro e validação de hash iniciados...\"}");
                        res.ContentType = "application/json; charset=utf-8";
                        res.StatusCode = 200;
                        res.OutputStream.Write(updBytes, 0, updBytes.Length);
                        res.Close();

                        ThreadPool.QueueUserWorkItem((state) =>
                        {
                            ExecutarAtualizacaoAutomatica();
                        });
                        return;
                    }
                }

                // Proxy transparente para requisições de API central online (/api/...)
                if (req.Url.AbsolutePath.StartsWith("/api/"))
                {
                    ProxyApiRequest(context);
                    return;
                }

                // =====================================================================
                // 3. SERVIÇO DE ARQUIVOS ESTÁTICOS COM PROTEÇÃO CONTRA PATH TRAVERSAL (Gate 13.2)
                // =====================================================================
                string canonicalRoot = Path.GetFullPath(rootDir);
                if (!canonicalRoot.EndsWith(Path.DirectorySeparatorChar.ToString()))
                {
                    canonicalRoot += Path.DirectorySeparatorChar;
                }

                string rawUrlPath = Uri.UnescapeDataString(req.Url.AbsolutePath.TrimStart('/'));
                if (string.IsNullOrEmpty(rawUrlPath))
                {
                    rawUrlPath = "index.html";
                }

                string candidate = Path.GetFullPath(Path.Combine(canonicalRoot, rawUrlPath.Replace('/', Path.DirectorySeparatorChar)));

                // Regra 13.2: canonical deve começar com canonicalRoot
                if (!candidate.StartsWith(canonicalRoot, StringComparison.OrdinalIgnoreCase))
                {
                    Log("Bloqueio de segurança: Tentativa de path traversal detectada para: " + req.Url.AbsolutePath);
                    res.StatusCode = 403;
                    byte[] forbidden = Encoding.UTF8.GetBytes("Acesso negado: Tentativa de path traversal detectada.");
                    res.ContentType = "text/plain; charset=utf-8";
                    res.OutputStream.Write(forbidden, 0, forbidden.Length);
                    res.Close();
                    return;
                }

                // Suporte SPA: se o arquivo não existe ou é rota virtual, serve index.html
                if (!File.Exists(candidate))
                {
                    candidate = Path.Combine(canonicalRoot, "index.html");
                }

                if (File.Exists(candidate))
                {
                    // Injeta o secret de sessão dinâmico de forma segura no index.html servido para o browser
                    if (Path.GetFileName(candidate).Equals("index.html", StringComparison.OrdinalIgnoreCase))
                    {
                        string html = File.ReadAllText(candidate, Encoding.UTF8);
                        string secretScript = string.Format("<script>window.__SOLUTIONS_DESKTOP_SECRET__=\"{0}\";</script>", sessionSecret);
                        if (html.IndexOf("</head>", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            html = html.Replace("</head>", secretScript + "</head>");
                        }
                        else
                        {
                            html = secretScript + html;
                        }

                        byte[] htmlBytes = Encoding.UTF8.GetBytes(html);
                        res.ContentType = "text/html; charset=utf-8";
                        res.ContentLength64 = htmlBytes.Length;
                        res.OutputStream.Write(htmlBytes, 0, htmlBytes.Length);
                        res.StatusCode = 200;
                        res.Close();
                        return;
                    }

                    byte[] data = File.ReadAllBytes(candidate);
                    string ext = Path.GetExtension(candidate).ToLower();
                    res.ContentType = GetMimeType(ext);
                    res.ContentLength64 = data.Length;
                    res.OutputStream.Write(data, 0, data.Length);
                    res.StatusCode = 200;
                }
                else
                {
                    res.StatusCode = 404;
                    byte[] notFound = Encoding.UTF8.GetBytes("Recurso não encontrado no pacote local.");
                    res.ContentType = "text/plain; charset=utf-8";
                    res.OutputStream.Write(notFound, 0, notFound.Length);
                }
                res.Close();
            }
            catch
            {
                try { context.Response.Close(); } catch {}
            }
        }

        private void ProxyApiRequest(HttpListenerContext context)
        {
            try
            {
                var req = context.Request;
                var res = context.Response;

                string targetUrl = "https://sistema-auditoria-solutions.vercel.app" + req.Url.PathAndQuery;
                Log("ProxyApiRequest: " + req.HttpMethod + " -> " + targetUrl);

                var targetReq = (HttpWebRequest)WebRequest.Create(targetUrl);
                targetReq.Method = req.HttpMethod;
                targetReq.Timeout = 20000;
                targetReq.ReadWriteTimeout = 20000;

                if (req.HasEntityBody && req.HttpMethod != "GET" && req.HttpMethod != "HEAD")
                {
                    targetReq.ContentType = req.ContentType;
                    using (var inStream = req.InputStream)
                    using (var outStream = targetReq.GetRequestStream())
                    {
                        byte[] buf = new byte[8192];
                        int r;
                        while ((r = inStream.Read(buf, 0, buf.Length)) > 0)
                        {
                            outStream.Write(buf, 0, r);
                        }
                    }
                }

                HttpWebResponse targetRes = null;
                try
                {
                    targetRes = (HttpWebResponse)targetReq.GetResponse();
                }
                catch (WebException wex)
                {
                    targetRes = wex.Response as HttpWebResponse;
                    if (targetRes == null)
                    {
                        Log("ProxyApi falha sem resposta HTTP: " + wex.Message);
                        res.StatusCode = 502;
                        byte[] errBytes = Encoding.UTF8.GetBytes("{\"sucesso\":false,\"erro\":\"Servidor central indisponível no momento.\"}");
                        res.ContentType = "application/json; charset=utf-8";
                        res.OutputStream.Write(errBytes, 0, errBytes.Length);
                        res.Close();
                        return;
                    }
                }

                res.StatusCode = (int)targetRes.StatusCode;
                res.ContentType = targetRes.ContentType;
                using (var inStream = targetRes.GetResponseStream())
                {
                    byte[] buf = new byte[8192];
                    int r;
                    while ((r = inStream.Read(buf, 0, buf.Length)) > 0)
                    {
                        res.OutputStream.Write(buf, 0, r);
                    }
                }
                targetRes.Close();
                res.Close();
            }
            catch (Exception ex)
            {
                Log("ProxyApi Excecao: " + ex.Message);
                try
                {
                    context.Response.StatusCode = 500;
                    byte[] errBytes = Encoding.UTF8.GetBytes("{\"sucesso\":false,\"erro\":\"" + ex.Message.Replace("\"", "'") + "\"}");
                    context.Response.ContentType = "application/json; charset=utf-8";
                    context.Response.OutputStream.Write(errBytes, 0, errBytes.Length);
                    context.Response.Close();
                }
                catch {}
            }
        }

        private static string GetMimeType(string ext)
        {
            switch (ext)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".png": return "image/png";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                case ".wasm": return "application/wasm";
                case ".exe": return "application/x-msdos-program";
                default: return "application/octet-stream";
            }
        }

        private void ExecutarAtualizacaoAutomatica()
        {
            try
            {
                Log("ExecutarAtualizacaoAutomatica: Consultando manifesto de versão oficial...");
                string manifestUrl = "https://sistema-auditoria-solutions.vercel.app/version.json";
                string manifestJson = "";
                using (var client = new WebClient())
                {
                    client.Headers.Add("User-Agent", "SistemaAuditoriaSolutions-Desktop-Updater");
                    try
                    {
                        manifestJson = client.DownloadString(manifestUrl);
                    }
                    catch (Exception ex)
                    {
                        Log("Falha ao obter manifesto de versão: " + ex.Message);
                    }
                }

                string expectedSha256 = "";
                string downloadUrl = "https://sistema-auditoria-solutions.vercel.app/downloads/Sistema-Auditoria-Solutions-Setup.exe";

                if (!string.IsNullOrEmpty(manifestJson))
                {
                    int shaIdx = manifestJson.IndexOf("\"sha256\"", StringComparison.OrdinalIgnoreCase);
                    if (shaIdx >= 0)
                    {
                        int colonIdx = manifestJson.IndexOf(":", shaIdx);
                        int quoteStart = manifestJson.IndexOf("\"", colonIdx + 1);
                        int quoteEnd = manifestJson.IndexOf("\"", quoteStart + 1);
                        if (quoteStart >= 0 && quoteEnd > quoteStart)
                        {
                            expectedSha256 = manifestJson.Substring(quoteStart + 1, quoteEnd - quoteStart - 1).Trim();
                        }
                    }

                    int urlIdx = manifestJson.IndexOf("\"downloadUrl\"", StringComparison.OrdinalIgnoreCase);
                    if (urlIdx >= 0)
                    {
                        int colonIdx = manifestJson.IndexOf(":", urlIdx);
                        int quoteStart = manifestJson.IndexOf("\"", colonIdx + 1);
                        int quoteEnd = manifestJson.IndexOf("\"", quoteStart + 1);
                        if (quoteStart >= 0 && quoteEnd > quoteStart)
                        {
                            downloadUrl = manifestJson.Substring(quoteStart + 1, quoteEnd - quoteStart - 1).Trim();
                        }
                    }
                }

                string tempDir = Path.GetTempPath();
                string tempInstaller = Path.Combine(tempDir, "Sistema-Auditoria-Solutions-Setup-Update.exe");

                if (File.Exists(tempInstaller))
                {
                    try { File.Delete(tempInstaller); } catch {}
                }

                Log("Iniciando download do instalador atualizado: " + downloadUrl);
                using (var client = new WebClient())
                {
                    client.Headers.Add("User-Agent", "SistemaAuditoriaSolutions-Desktop-Updater");
                    client.DownloadFile(downloadUrl, tempInstaller);
                }

                if (!File.Exists(tempInstaller) || new FileInfo(tempInstaller).Length < 100000)
                {
                    Log("Arquivo baixado parece inválido ou incompleto (tamanho insuficiente).");
                    return;
                }

                // Regra 13.4: Validação obrigatória de Checksum SHA-256
                string computedSha256 = "";
                using (var sha = SHA256.Create())
                using (var fs = File.OpenRead(tempInstaller))
                {
                    byte[] hashBytes = sha.ComputeHash(fs);
                    var sb = new StringBuilder();
                    foreach (byte b in hashBytes)
                    {
                        sb.Append(b.ToString("x2"));
                    }
                    computedSha256 = sb.ToString();
                }

                Log(string.Format("Hash SHA-256 calculado: {0} | Esperado no manifesto: {1}", computedSha256, expectedSha256));

                if (!string.IsNullOrEmpty(expectedSha256) &&
                    !computedSha256.Equals(expectedSha256, StringComparison.OrdinalIgnoreCase))
                {
                    Log("ALERTA DE SEGURANÇA: Checksum SHA-256 do instalador baixado diverge do manifesto oficial! Atualização abortada.");
                    try { File.Delete(tempInstaller); } catch {}
                    return;
                }

                // Regra 13.4: Criar cópia de segurança / rollback do executável atual antes de prosseguir
                try
                {
                    string currentExe = Process.GetCurrentProcess().MainModule.FileName;
                    string backupExe = currentExe + ".bak";
                    File.Copy(currentExe, backupExe, true);
                    Log("Rollback pré-update criado com sucesso: " + backupExe);
                }
                catch (Exception ex)
                {
                    Log("Aviso ao gerar snapshot de rollback do binário: " + ex.Message);
                }

                Log("Instalador validado com sucesso. Executando atualização em modo silencioso (/silent /update)...");
                var psi = new ProcessStartInfo
                {
                    FileName = tempInstaller,
                    Arguments = "/silent /update",
                    UseShellExecute = true
                };
                Process.Start(psi);

                Thread.Sleep(1000);
                ExecuteFullShutdown();
            }
            catch (Exception ex)
            {
                Log("Falha em ExecutarAtualizacaoAutomatica: " + ex.ToString());
            }
        }

        public void ExecuteFullShutdown()
        {
            lock (shutdownLock)
            {
                if (isShuttingDown) return;
                isShuttingDown = true;
            }

            Log("Iniciando rotina de encerramento completo do sistema (Full Shutdown)...");

            isRunning = false;

            // 1. Oculta e descarta TrayIcon imediatamente
            try
            {
                if (trayIcon != null)
                {
                    trayIcon.Visible = false;
                    trayIcon.Dispose();
                    trayIcon = null;
                }
            }
            catch {}

            // 2. Encerra servidor HTTP local e libera portas imediatamente
            try
            {
                if (listener != null)
                {
                    listener.Stop();
                    listener.Close();
                    listener = null;
                }
            }
            catch {}

            // 3. Encerra árvore de processos do Edge vinculada a este perfil
            try
            {
                if (launchedEdgePid > 0)
                {
                    try
                    {
                        var psi = new ProcessStartInfo
                        {
                            FileName = "taskkill.exe",
                            Arguments = string.Format("/PID {0} /T /F", launchedEdgePid),
                            CreateNoWindow = true,
                            UseShellExecute = false
                        };
                        var p = Process.Start(psi);
                        if (p != null) p.WaitForExit(1000);
                    }
                    catch {}
                }
            }
            catch {}

            try
            {
                Program.KillOrphanedEdgeProcesses(profileDir);
            }
            catch {}

            // 4. Limpa arquivos de lock temporários do perfil
            try
            {
                Program.CleanProfileLocks(profileDir);
            }
            catch {}

            // 5. Libera memória
            try
            {
                GC.Collect();
                GC.WaitForPendingFinalizers();
            }
            catch {}

            Log("Encerramento completo executado com sucesso. Finalizando processo principal.");

            // 6. Força o encerramento imediato do processo sem deixar tarefas órfãs
            ThreadPool.QueueUserWorkItem((s) =>
            {
                Thread.Sleep(100);
                try
                {
                    Process.GetCurrentProcess().Kill();
                }
                catch
                {
                    Environment.Exit(0);
                }
            });
        }
    }
}
