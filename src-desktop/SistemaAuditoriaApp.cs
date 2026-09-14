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
        private static HttpListener listener;
        private static Thread serverThread;
        private static bool isRunning = true;
        private static int port = 5173;
        private static string appRoot;

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                appRoot = AppDomain.CurrentDomain.BaseDirectory;
                string distPath = Path.Combine(appRoot, "dist");
                if (!Directory.Exists(distPath))
                {
                    distPath = appRoot; // Em execução direta
                }

                // Encontra uma porta local livre
                port = FindFreePort(5173);

                // Inicia o servidor local de arquivos estáticos
                StartWebServer(distPath, port);

                // Inicia a janela no modo Aplicativo nativo
                string appUrl = string.Format("http://127.0.0.1:{0}/", port);
                string profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SistemaAuditoriaSolutions", "UserData");
                if (!Directory.Exists(profileDir))
                {
                    Directory.CreateDirectory(profileDir);
                }

                Process browserProc = LaunchAppWindow(appUrl, profileDir);
                if (browserProc != null)
                {
                    browserProc.WaitForExit();
                }
                else
                {
                    // Fallback para navegador padrão
                    Process.Start(appUrl);
                    MessageBox.Show(
                        "O Sistema de Auditoria Grupo Solutions está em execução.\nClique em OK quando desejar encerrar a aplicação.",
                        "Sistema de Auditoria Solutions - Samsung",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Erro ao inicializar o Sistema de Auditoria:\n" + ex.Message,
                    "Erro de Inicialização",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
            finally
            {
                StopWebServer();
            }
        }

        private static int FindFreePort(int startPort)
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

        private static void StartWebServer(string rootDir, int listenPort)
        {
            listener = new HttpListener();
            listener.Prefixes.Add(string.Format("http://127.0.0.1:{0}/", listenPort));
            listener.Start();

            serverThread = new Thread(() =>
            {
                while (isRunning && listener.IsListening)
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

        private static void HandleRequest(HttpListenerContext context, string rootDir)
        {
            try
            {
                var req = context.Request;
                var res = context.Response;

                // Suporte a CORS
                res.AddHeader("Access-Control-Allow-Origin", "*");
                res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.AddHeader("Access-Control-Allow-Headers", "Content-Type");

                if (req.HttpMethod == "OPTIONS")
                {
                    res.StatusCode = 204;
                    res.Close();
                    return;
                }

                string urlPath = req.Url.AbsolutePath.TrimStart('/');
                if (string.IsNullOrEmpty(urlPath))
                {
                    urlPath = "index.html";
                }

                string filePath = Path.Combine(rootDir, urlPath.Replace('/', Path.DirectorySeparatorChar));

                // Suporte SPA: se o arquivo não existe e não tem extensão, serve index.html
                if (!File.Exists(filePath))
                {
                    if (!urlPath.Contains("."))
                    {
                        filePath = Path.Combine(rootDir, "index.html");
                    }
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
                    byte[] notFound = Encoding.UTF8.GetBytes("Recurso não encontrado");
                    res.OutputStream.Write(notFound, 0, notFound.Length);
                }
                res.Close();
            }
            catch
            {
                try { context.Response.Close(); } catch {}
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
                default: return "application/octet-stream";
            }
        }

        private static Process LaunchAppWindow(string url, string profileDir)
        {
            // Tenta Microsoft Edge em App Mode (nativo em todo Windows 10 e 11)
            string[] possiblePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft\\Edge\\Application\\msedge.exe"),
                "msedge.exe"
            };

            foreach (var edgePath in possiblePaths)
            {
                if (edgePath == "msedge.exe" || File.Exists(edgePath))
                {
                    try
                    {
                        var psi = new ProcessStartInfo
                        {
                            FileName = edgePath,
                            Arguments = string.Format("--app=\"{0}\" --user-data-dir=\"{1}\" --window-size=1280,850", url, profileDir),
                            UseShellExecute = true
                        };
                        return Process.Start(psi);
                    }
                    catch {}
                }
            }
            return null;
        }

        private static void StopWebServer()
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
    }
}

