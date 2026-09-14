using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;
using System.Drawing;

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

            bool isNewInstance;
            using (Mutex singleInstanceMutex = new Mutex(true, "Global\\SistemaAuditoriaSolutions_SingleInstance_Mutex", out isNewInstance))
            {
                if (!isNewInstance)
                {
                    try
                    {
                        File.AppendAllText(logPath, string.Format("[{0}] Outra instância do aplicativo já está em execução. Encerrando processo duplicado.\n", DateTime.Now));
                    }
                    catch {}
                    return;
                }

                try
                {
                    try
                    {
                        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;
                    }
                    catch {}

                    File.AppendAllText(logPath, string.Format("\n[{0}] Iniciando aplicacao (instancia unica ativa)...\n", DateTime.Now));
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    File.AppendAllText(logPath, string.Format("[{0}] Executando AuditoriaAppContext...\n", DateTime.Now));
                    Application.Run(new AuditoriaAppContext(logPath));
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
            }
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

        public AuditoriaAppContext(string log)
        {
            this.logFile = log;
            try
            {
                Log("AuditoriaAppContext iniciado.");
                string appRoot = AppDomain.CurrentDomain.BaseDirectory;
                distPath = Path.Combine(appRoot, "dist");
                if (!Directory.Exists(distPath))
                {
                    distPath = appRoot; // Fallback se executado direto da pasta com index.html
                }
                Log("distPath: " + distPath);

                profileDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SistemaAuditoriaSolutions",
                    "UserData"
                );
                if (!Directory.Exists(profileDir))
                {
                    Directory.CreateDirectory(profileDir);
                }
                Log("profileDir: " + profileDir);

                // 1. Encontra porta livre
                port = FindFreePort(5173);
                Log("Porta selecionada: " + port);

                // 2. Inicia o servidor local de arquivos estáticos
                StartWebServer(distPath, port);
                Log("Servidor Web iniciado com sucesso.");

                // Aguarda 400ms para certificar que o socket está ouvindo
                Thread.Sleep(400);

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
                ExitThread();
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

            var itemSair = menu.Items.Add("❌ Sair do Sistema");
            itemSair.Click += (s, e) => ExitApplication();

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

            try
            {
                trayIcon.ShowBalloonTip(
                    3000,
                    "Sistema de Auditoria Solutions - Samsung",
                    string.Format("O aplicativo está em execução no endereço http://127.0.0.1:{0}/\nClique duas vezes aqui para reabrir a janela.", port),
                    ToolTipIcon.Info
                );
            }
            catch {}
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
                            Arguments = string.Format("--app={0} --user-data-dir=\"{1}\" --no-first-run --no-default-browser-check", url, profile),
                            UseShellExecute = true
                        };
                        Log("Iniciando Edge: " + edgePath + " args: " + psi.Arguments);
                        Process.Start(psi);
                        launched = true;
                        break;
                    }
                    catch (Exception ex)
                    {
                        Log("Falha ao iniciar Edge (" + edgePath + "): " + ex.Message);
                    }

                }
            }

            if (!launched)
            {
                // Fallback: abre no navegador padrão
                try
                {
                    Process.Start(url);
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

                // Suporte a CORS
                res.AddHeader("Access-Control-Allow-Origin", "*");
                res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.AddHeader("Access-Control-Allow-Headers", "Content-Type");
                res.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate");

                if (req.HttpMethod == "OPTIONS")
                {
                    res.StatusCode = 204;
                    res.Close();
                    return;
                }

                // Proxy transparente para requisições de API central online (/api/...)
                if (req.Url.AbsolutePath.StartsWith("/api/"))
                {
                    ProxyApiRequest(context);
                    return;
                }

                string urlPath = req.Url.AbsolutePath.TrimStart('/');
                if (string.IsNullOrEmpty(urlPath))
                {
                    urlPath = "index.html";
                }

                string filePath = Path.Combine(rootDir, urlPath.Replace('/', Path.DirectorySeparatorChar));

                // Suporte SPA: se o arquivo não existe ou é rota virtual, serve index.html
                if (!File.Exists(filePath))
                {
                    filePath = Path.Combine(rootDir, "index.html");
                }

                if (File.Exists(filePath))
                {
                    byte[] data = File.ReadAllBytes(filePath);
                    string ext = Path.GetExtension(filePath).ToLower();
                    res.ContentType = GetMimeType(ext);
                    res.ContentLength64 = data.Length;
                    res.OutputStream.Write(data, 0, data.Length);
                    res.StatusCode = 200;
                }
                else
                {
                    res.StatusCode = 404;
                    byte[] notFound = Encoding.UTF8.GetBytes("Recurso não encontrado no pacote local.");
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

        private void StopWebServer()
        {
            isRunning = false;
            try
            {
                if (listener != null && listener.IsListening)
                {
                    listener.Stop();
                    listener.Close();
                }
            }
            catch {}
        }

        private void ExitApplication()
        {
            StopWebServer();
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }
            ExitThread();
        }
    }
}
