using System;
using System.IO;
using System.Drawing;
using System.Windows.Forms;
using System.Diagnostics;
using System.IO.Compression;
using Microsoft.Win32;

namespace SistemaAuditoriaInstaller
{
    public class InstallerForm : Form
    {
        private Panel panelHeader;
        private Label lblTitle;
        private Label lblSubtitle;
        private Panel panelContent;
        private Panel panelFooter;
        private Button btnNext;
        private Button btnCancel;
        private Button btnBack;
        private ProgressBar progressBar;
        private Label lblStatus;
        private CheckBox chkLaunchNow;
        private CheckBox chkDesktopShortcut;
        private CheckBox chkStartMenuShortcut;
        private TextBox txtInstallDir;
        private Button btnBrowse;

        private int currentStep = 1;
        private string targetDir;

        public InstallerForm()
        {
            InitializeComponent();
            targetDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SistemaAuditoriaSolutions");
            txtInstallDir.Text = targetDir;
            ShowStep(1);
        }

        private void InitializeComponent()
        {
            this.Text = "Assistente de Instalação - Sistema de Auditoria Grupo Solutions";
            this.Size = new Size(580, 420);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = true;
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            this.BackColor = Color.FromArgb(248, 250, 252);

            // Cabeçalho
            panelHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 80,
                BackColor = Color.FromArgb(15, 23, 42) // Slate 900
            };

            lblTitle = new Label
            {
                Text = "SISTEMA DE AUDITORIA GRUPO SOLUTIONS",
                Font = new Font("Segoe UI", 11F, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(20, 16),
                AutoSize = true
            };

            lblSubtitle = new Label
            {
                Text = "Conferência, Qualidade e Rastreabilidade Samsung • Versão 1.3.2",
                Font = new Font("Segoe UI", 8.5F, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(20, 42),
                AutoSize = true
            };

            panelHeader.Controls.Add(lblTitle);
            panelHeader.Controls.Add(lblSubtitle);

            // Rodapé
            panelFooter = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 60,
                BackColor = Color.FromArgb(241, 245, 249)
            };

            btnCancel = new Button
            {
                Text = "Cancelar",
                Location = new Point(460, 16),
                Size = new Size(90, 30),
                BackColor = Color.White,
                FlatStyle = FlatStyle.System
            };
            btnCancel.Click += (s, e) => this.Close();

            btnNext = new Button
            {
                Text = "Avançar >",
                Location = new Point(360, 16),
                Size = new Size(90, 30),
                BackColor = Color.FromArgb(37, 99, 235),
                ForeColor = Color.Black,
                FlatStyle = FlatStyle.System,
                Font = new Font("Segoe UI", 9F, FontStyle.Bold)
            };
            btnNext.Click += BtnNext_Click;

            btnBack = new Button
            {
                Text = "< Voltar",
                Location = new Point(260, 16),
                Size = new Size(90, 30),
                BackColor = Color.White,
                FlatStyle = FlatStyle.System,
                Visible = false
            };
            btnBack.Click += (s, e) => ShowStep(currentStep - 1);

            panelFooter.Controls.Add(btnCancel);
            panelFooter.Controls.Add(btnNext);
            panelFooter.Controls.Add(btnBack);

            // Conteúdo
            panelContent = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(25)
            };

            // Controles de etapas
            progressBar = new ProgressBar
            {
                Location = new Point(30, 80),
                Size = new Size(500, 24),
                Style = ProgressBarStyle.Continuous,
                Visible = false
            };

            lblStatus = new Label
            {
                Location = new Point(30, 115),
                Size = new Size(500, 40),
                Font = new Font("Segoe UI", 8.5F),
                ForeColor = Color.FromArgb(71, 85, 105),
                Visible = false
            };

            txtInstallDir = new TextBox
            {
                Location = new Point(30, 95),
                Size = new Size(400, 26),
                ReadOnly = true
            };

            btnBrowse = new Button
            {
                Text = "Procurar...",
                Location = new Point(440, 93),
                Size = new Size(90, 28)
            };
            btnBrowse.Click += (s, e) =>
            {
                using (var fbd = new FolderBrowserDialog())
                {
                    fbd.SelectedPath = targetDir;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        targetDir = Path.Combine(fbd.SelectedPath, "SistemaAuditoriaSolutions");
                        txtInstallDir.Text = targetDir;
                    }
                }
            };

            chkDesktopShortcut = new CheckBox
            {
                Text = "Criar atalho na Área de Trabalho (Desktop)",
                Checked = true,
                Location = new Point(30, 145),
                AutoSize = true,
                Font = new Font("Segoe UI", 9F, FontStyle.Bold)
            };

            chkStartMenuShortcut = new CheckBox
            {
                Text = "Criar atalho no Menu Iniciar do Windows",
                Checked = true,
                Location = new Point(30, 175),
                AutoSize = true,
                Font = new Font("Segoe UI", 9F, FontStyle.Bold)
            };

            chkLaunchNow = new CheckBox
            {
                Text = "Iniciar o Sistema de Auditoria Grupo Solutions agora",
                Checked = true,
                Location = new Point(30, 160),
                AutoSize = true,
                Font = new Font("Segoe UI", 9.5F, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 58, 138),
                Visible = false
            };

            panelContent.Controls.Add(progressBar);
            panelContent.Controls.Add(lblStatus);
            panelContent.Controls.Add(txtInstallDir);
            panelContent.Controls.Add(btnBrowse);
            panelContent.Controls.Add(chkDesktopShortcut);
            panelContent.Controls.Add(chkStartMenuShortcut);
            panelContent.Controls.Add(chkLaunchNow);

            this.Controls.Add(panelContent);
            this.Controls.Add(panelFooter);
            this.Controls.Add(panelHeader);
        }

        private void ShowStep(int step)
        {
            currentStep = step;
            panelContent.Controls.Clear();

            if (step == 1)
            {
                btnBack.Visible = false;
                btnNext.Text = "Avançar >";
                btnNext.Enabled = true;

                Label lblWelcome = new Label
                {
                    Text = "Bem-vindo ao Assistente de Instalação",
                    Font = new Font("Segoe UI", 13F, FontStyle.Bold),
                    ForeColor = Color.FromArgb(15, 23, 42),
                    Location = new Point(25, 20),
                    AutoSize = true
                };

                Label lblDesc = new Label
                {
                    Text = "Este assistente instalará o Sistema de Auditoria Grupo Solutions (Samsung) no seu computador.\n\n" +
                           "Destaques da versão instalada:\n" +
                           "  • Operação 100% Offline com banco local protegido;\n" +
                           "  • Atalhos rápidos na Área de Trabalho e Menu Iniciar;\n" +
                           "  • Janela exclusiva de alta velocidade;\n" +
                           "  • Sincronização e proteção contra duplicidades de IMEI;\n\n" +
                           "Clique em 'Avançar' para continuar a instalação.",
                    Location = new Point(25, 55),
                    Size = new Size(510, 180),
                    Font = new Font("Segoe UI", 9.5F),
                    ForeColor = Color.FromArgb(51, 65, 85)
                };

                panelContent.Controls.Add(lblWelcome);
                panelContent.Controls.Add(lblDesc);
            }
            else if (step == 2)
            {
                btnBack.Visible = true;
                btnNext.Text = "Instalar";
                btnNext.Enabled = true;

                Label lblDirTitle = new Label
                {
                    Text = "Pasta de Destino e Atalhos",
                    Font = new Font("Segoe UI", 11F, FontStyle.Bold),
                    ForeColor = Color.FromArgb(15, 23, 42),
                    Location = new Point(25, 15),
                    AutoSize = true
                };

                Label lblDirDesc = new Label
                {
                    Text = "O programa será instalado na seguinte pasta:",
                    Location = new Point(25, 45),
                    AutoSize = true
                };

                txtInstallDir.Location = new Point(25, 75);
                btnBrowse.Location = new Point(435, 73);
                chkDesktopShortcut.Location = new Point(25, 125);
                chkStartMenuShortcut.Location = new Point(25, 155);

                panelContent.Controls.Add(lblDirTitle);
                panelContent.Controls.Add(lblDirDesc);
                panelContent.Controls.Add(txtInstallDir);
                panelContent.Controls.Add(btnBrowse);
                panelContent.Controls.Add(chkDesktopShortcut);
                panelContent.Controls.Add(chkStartMenuShortcut);
            }
            else if (step == 3)
            {
                btnBack.Visible = false;
                btnCancel.Enabled = false;
                btnNext.Enabled = false;
                btnNext.Text = "Instalando...";

                Label lblInstalling = new Label
                {
                    Text = "Instalando o Sistema de Auditoria...",
                    Font = new Font("Segoe UI", 11F, FontStyle.Bold),
                    ForeColor = Color.FromArgb(15, 23, 42),
                    Location = new Point(25, 20),
                    AutoSize = true
                };

                progressBar.Location = new Point(25, 65);
                progressBar.Visible = true;
                progressBar.Value = 10;

                lblStatus.Location = new Point(25, 100);
                lblStatus.Visible = true;
                lblStatus.Text = "Preparando diretório de instalação...";

                panelContent.Controls.Add(lblInstalling);
                panelContent.Controls.Add(progressBar);
                panelContent.Controls.Add(lblStatus);

                var timer = new System.Windows.Forms.Timer { Interval = 200 };
                timer.Tick += (s, e) =>
                {
                    timer.Stop();
                    ExecuteInstallation();
                };
                timer.Start();
            }
            else if (step == 4)
            {
                btnBack.Visible = false;
                btnCancel.Visible = false;
                btnNext.Text = "Concluir";
                btnNext.Enabled = true;

                Label lblFinished = new Label
                {
                    Text = "Instalação Concluída com Sucesso!",
                    Font = new Font("Segoe UI", 13F, FontStyle.Bold),
                    ForeColor = Color.FromArgb(16, 149, 193),
                    Location = new Point(25, 20),
                    AutoSize = true
                };

                Label lblFinishDesc = new Label
                {
                    Text = "O Sistema de Auditoria Grupo Solutions - Samsung foi instalado com sucesso neste computador.\n\n" +
                           "Atalhos foram criados na sua Área de Trabalho e no Menu Iniciar.\n" +
                           "No primeiro acesso, o sistema executará a carga inicial obrigatória das configurações oficiais.",
                    Location = new Point(25, 60),
                    Size = new Size(510, 90),
                    Font = new Font("Segoe UI", 9.5F),
                    ForeColor = Color.FromArgb(51, 65, 85)
                };

                chkLaunchNow.Location = new Point(25, 160);
                chkLaunchNow.Visible = true;

                panelContent.Controls.Add(lblFinished);
                panelContent.Controls.Add(lblFinishDesc);
                panelContent.Controls.Add(chkLaunchNow);
            }
        }

        private void BtnNext_Click(object sender, EventArgs e)
        {
            if (currentStep == 1)
            {
                ShowStep(2);
            }
            else if (currentStep == 2)
            {
                ShowStep(3);
            }
            else if (currentStep == 4)
            {
                if (chkLaunchNow.Checked)
                {
                    string exePath = Path.Combine(targetDir, "SistemaAuditoriaSolutions.exe");
                    if (File.Exists(exePath))
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = exePath,
                            WorkingDirectory = targetDir
                        });
                    }
                }
                this.Close();
            }
        }

        private void ExecuteInstallation()
        {
            try
            {
                // Encerra qualquer instância anterior do aplicativo para não travar os arquivos
                try
                {
                    foreach (var p in Process.GetProcessesByName("SistemaAuditoriaSolutions"))
                    {
                        try { p.Kill(); p.WaitForExit(1500); } catch {}
                    }
                }
                catch {}

                lblStatus.Text = "Criando pastas de instalação...";
                progressBar.Value = 25;
                Application.DoEvents();

                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                lblStatus.Text = "Extraindo e instalando arquivos da aplicação...";
                progressBar.Value = 50;
                Application.DoEvents();

                bool extractedFromResource = false;
                try
                {
                    var assembly = System.Reflection.Assembly.GetExecutingAssembly();
                    using (var resStream = assembly.GetManifestResourceStream("Payload.zip"))
                    {
                        if (resStream != null)
                        {
                            using (var archive = new System.IO.Compression.ZipArchive(resStream))
                            {
                                string canonicalTarget = Path.GetFullPath(targetDir);
                                if (!canonicalTarget.EndsWith(Path.DirectorySeparatorChar.ToString()))
                                {
                                    canonicalTarget += Path.DirectorySeparatorChar;
                                }

                                foreach (var entry in archive.Entries)
                                {
                                    string destPath = Path.GetFullPath(Path.Combine(targetDir, entry.FullName));
                                    if (!destPath.StartsWith(canonicalTarget, StringComparison.OrdinalIgnoreCase))
                                    {
                                        throw new InvalidOperationException(string.Format("Entrada maliciosa de arquivo detectada no pacote ZIP (Zip Slip bloqueado): {0}", entry.FullName));
                                    }

                                    if (entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\"))
                                    {
                                        Directory.CreateDirectory(destPath);
                                    }
                                    else
                                    {
                                        string parentDir = Path.GetDirectoryName(destPath);
                                        if (!Directory.Exists(parentDir))
                                        {
                                            Directory.CreateDirectory(parentDir);
                                        }
                                        entry.ExtractToFile(destPath, true);
                                    }
                                }
                            }
                            extractedFromResource = true;
                        }
                    }
                }
                catch
                {
                    extractedFromResource = false;
                }

                if (!extractedFromResource)
                {
                    string sourceDir = AppDomain.CurrentDomain.BaseDirectory;
                    CopyDirectory(sourceDir, targetDir);
                }

                lblStatus.Text = "Configurando atalhos no Windows...";
                progressBar.Value = 75;
                Application.DoEvents();


                string exePath = Path.Combine(targetDir, "SistemaAuditoriaSolutions.exe");
                string icoPath = Path.Combine(targetDir, "app.ico");

                if (chkDesktopShortcut.Checked)
                {
                    string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                    string shortcutPath = Path.Combine(desktopPath, "Sistema de Auditoria Solutions.lnk");
                    CreateShortcut(shortcutPath, exePath, targetDir, icoPath);
                }

                if (chkStartMenuShortcut.Checked)
                {
                    string startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Sistema de Auditoria Solutions");
                    if (!Directory.Exists(startMenu)) Directory.CreateDirectory(startMenu);
                    string shortcutPath = Path.Combine(startMenu, "Sistema de Auditoria Solutions.lnk");
                    CreateShortcut(shortcutPath, exePath, targetDir, icoPath);
                }

                lblStatus.Text = "Registrando aplicação no Windows...";
                progressBar.Value = 90;
                Application.DoEvents();

                RegisterUninstaller(targetDir, exePath);

                progressBar.Value = 100;
                lblStatus.Text = "Instalação concluída!";
                Application.DoEvents();

                System.Threading.Thread.Sleep(400);
                ShowStep(4);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro durante a instalação: " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
                this.Close();
            }
        }

        private static void CopyDirectory(string source, string dest)
        {
            foreach (string dir in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
            {
                string rel = dir.Substring(source.Length).TrimStart(Path.DirectorySeparatorChar);
                if (rel.StartsWith("UserData", StringComparison.OrdinalIgnoreCase)) continue;
                string newDir = Path.Combine(dest, rel);
                if (!Directory.Exists(newDir)) Directory.CreateDirectory(newDir);
            }

            foreach (string file in Directory.GetFiles(source, "*.*", SearchOption.AllDirectories))
            {
                string rel = file.Substring(source.Length).TrimStart(Path.DirectorySeparatorChar);
                if (rel.StartsWith("UserData", StringComparison.OrdinalIgnoreCase)) continue;
                if (Path.GetFileName(file).StartsWith("Instalador", StringComparison.OrdinalIgnoreCase) ||
                    Path.GetFileName(file).StartsWith("Sistema-Auditoria-Solutions-Setup", StringComparison.OrdinalIgnoreCase)) continue;

                string destFile = Path.Combine(dest, rel);
                File.Copy(file, destFile, true);
            }
        }

        private static void CreateShortcut(string shortcutPath, string targetPath, string workingDir, string iconPath)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetPath;
                    shortcut.WorkingDirectory = workingDir;
                    if (File.Exists(iconPath))
                    {
                        shortcut.IconLocation = iconPath;
                    }
                    shortcut.Description = "Sistema de Auditoria e Rastreabilidade Samsung - Grupo Solutions";
                    shortcut.Save();
                }
            }
            catch {}
        }

        private static void RegisterUninstaller(string installDir, string exePath)
        {
            try
            {
                using (var key = Registry.CurrentUser.CreateSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SistemaAuditoriaSolutions"))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "Sistema de Auditoria Grupo Solutions - Samsung v1.3.2");
                        key.SetValue("DisplayVersion", "1.3.2");
                        key.SetValue("Publisher", "Grupo Solutions");
                        key.SetValue("InstallLocation", installDir);
                        key.SetValue("DisplayIcon", exePath);
                        key.SetValue("UninstallString", string.Format("cmd.exe /c rmdir /s /q \"{0}\"", installDir));
                    }
                }
            }
            catch {}
        }

        public static bool ExecuteSilentInstallation(string targetDir, bool launchAfter)
        {
            try
            {
                // 1. Encerra instâncias anteriores do aplicativo
                foreach (var p in Process.GetProcessesByName("SistemaAuditoriaSolutions"))
                {
                    try { p.Kill(); p.WaitForExit(2000); } catch {}
                }

                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                // 2. Extrai arquivos do payload embutido
                bool extracted = false;
                try
                {
                    var assembly = System.Reflection.Assembly.GetExecutingAssembly();
                    using (var resStream = assembly.GetManifestResourceStream("Payload.zip"))
                    {
                        if (resStream != null)
                        {
                            using (var archive = new System.IO.Compression.ZipArchive(resStream))
                            {
                                string canonicalTarget = Path.GetFullPath(targetDir);
                                if (!canonicalTarget.EndsWith(Path.DirectorySeparatorChar.ToString()))
                                {
                                    canonicalTarget += Path.DirectorySeparatorChar;
                                }

                                foreach (var entry in archive.Entries)
                                {
                                    string destPath = Path.GetFullPath(Path.Combine(targetDir, entry.FullName));
                                    if (!destPath.StartsWith(canonicalTarget, StringComparison.OrdinalIgnoreCase))
                                    {
                                        throw new InvalidOperationException(string.Format("Entrada maliciosa de arquivo detectada no pacote ZIP (Zip Slip bloqueado): {0}", entry.FullName));
                                    }

                                    if (entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\"))
                                    {
                                        Directory.CreateDirectory(destPath);
                                    }
                                    else
                                    {
                                        string parentDir = Path.GetDirectoryName(destPath);
                                        if (!Directory.Exists(parentDir))
                                        {
                                            Directory.CreateDirectory(parentDir);
                                        }
                                        entry.ExtractToFile(destPath, true);
                                    }
                                }
                            }
                            extracted = true;
                        }
                    }
                }
                catch {}

                if (!extracted)
                {
                    string sourceDir = AppDomain.CurrentDomain.BaseDirectory;
                    CopyDirectory(sourceDir, targetDir);
                }

                // 3. Atualiza atalhos
                string exePath = Path.Combine(targetDir, "SistemaAuditoriaSolutions.exe");
                string icoPath = Path.Combine(targetDir, "app.ico");
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktopPath, "Sistema de Auditoria Solutions.lnk");
                CreateShortcut(shortcutPath, exePath, targetDir, icoPath);

                string startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Sistema de Auditoria Solutions");
                if (!Directory.Exists(startMenu)) Directory.CreateDirectory(startMenu);
                string startShortcut = Path.Combine(startMenu, "Sistema de Auditoria Solutions.lnk");
                CreateShortcut(startShortcut, exePath, targetDir, icoPath);

                RegisterUninstaller(targetDir, exePath);

                // 4. Inicia o aplicativo atualizado
                if (launchAfter && File.Exists(exePath))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = exePath,
                        WorkingDirectory = targetDir
                    });
                }
                return true;
            }
            catch
            {
                return false;
            }
        }

        [STAThread]
        static void Main(string[] args)
        {
            bool isSilent = false;
            if (args != null && args.Length > 0)
            {
                foreach (var arg in args)
                {
                    if (arg.Equals("/silent", StringComparison.OrdinalIgnoreCase) ||
                        arg.Equals("/update", StringComparison.OrdinalIgnoreCase) ||
                        arg.Equals("-silent", StringComparison.OrdinalIgnoreCase) ||
                        arg.Equals("/quiet", StringComparison.OrdinalIgnoreCase))
                    {
                        isSilent = true;
                        break;
                    }
                }
            }

            if (isSilent)
            {
                string targetDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SistemaAuditoriaSolutions");
                ExecuteSilentInstallation(targetDir, true);
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }
}

