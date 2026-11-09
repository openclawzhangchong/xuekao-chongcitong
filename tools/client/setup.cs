using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

/* 学考冲刺通 · 课堂版 安装器
 * payload.zip 以嵌入资源随包（构建脚本打包），安装 = 解压到目标目录 + 快捷方式。
 * --silent    静默安装到默认路径（C:\学考冲刺通）
 * --uninstall 删除目标目录与快捷方式 */

static class Program {
    [STAThread]
    static int Main(string[] args) {
        if (args.Length > 0 && args[0] == "--silent") { SilentInstall(); return 0; }
        if (args.Length > 0 && args[0] == "--uninstall") { Uninstall(DefaultPath()); return 0; }
        Application.EnableVisualStyles();
        Application.Run(new SetupForm());
        return 0;
    }

    public static string DefaultPath() { return "C:" + Path.DirectorySeparatorChar + "学考冲刺通"; }

    public static void InstallTo(string target) {
        StopOldService();   // 旧服务占着 8953/pythonw.exe 会导致：①文件占用安装失败 ②装完打开的仍是旧内容
        var asm = Assembly.GetExecutingAssembly();
        using (var stream = asm.GetManifestResourceStream("payload.zip")) {
            if (stream == null) throw new Exception("安装包缺少内嵌资源 payload.zip");
            using (var za = new ZipArchive(stream)) {
                foreach (var e in za.Entries) {
                    var dest = Path.Combine(target, e.FullName);
                    var dir = Path.GetDirectoryName(dest);
                    if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                    if (e.FullName.EndsWith("/")) continue;
                    e.ExtractToFile(dest, true);
                }
            }
        }
        MakeShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "学考冲刺通课堂版.lnk"), target);
        var startMenu = Environment.GetFolderPath(Environment.SpecialFolder.StartMenu);
        MakeShortcut(Path.Combine(startMenu, "学考冲刺通课堂版.lnk"), target);
    }

    /* 停掉旧课堂版：杀 8953 监听进程 + 杀旧 launcher——修「装了新版还是旧页面」与文件占用安装失败 */
    public static void StopOldService() {
        try {
            var psi = new ProcessStartInfo("cmd.exe", "/c netstat -ano | findstr :8953 | findstr LISTENING");
            psi.UseShellExecute = false;
            psi.RedirectStandardOutput = true;
            psi.CreateNoWindow = true;
            var outp = Process.Start(psi).StandardOutput.ReadToEnd();
            foreach (var line in outp.Split('\n')) {
                var parts = line.Trim().Split(' ');
                if (parts.Length >= 5) {
                    int tmp;
                    var pid = parts[parts.Length - 1].Trim();
                    if (int.TryParse(pid, out tmp)) {
                        try {
                            var k = new ProcessStartInfo("taskkill", "/F /T /PID " + pid);
                            k.UseShellExecute = false; k.CreateNoWindow = true;
                            Process.Start(k).WaitForExit(3000);
                        } catch { }
                    }
                }
            }
        } catch { }
        try {
            foreach (var p in Process.GetProcessesByName("学考冲刺通")) {
                try { p.Kill(); p.WaitForExit(3000); } catch { }
            }
        } catch { }
        System.Threading.Thread.Sleep(500);
    }

    public static void MakeShortcut(string lnk, string target) {
        try {
            var exe = Path.Combine(target, "学考冲刺通.exe");
            var ico = Path.Combine(target, "icon.ico");
            var cmd = "$ws = New-Object -ComObject WScript.Shell; " +
                "$s = $ws.CreateShortcut('" + lnk + "'); " +
                "$s.TargetPath = '" + exe + "'; " +
                "$s.WorkingDirectory = '" + target + "'; " +
                "$s.IconLocation = '" + ico + "'; " +
                "$s.Save()";
            var psi = new ProcessStartInfo("powershell.exe", "-NoProfile -Command \"" + cmd + "\"");
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            Process.Start(psi).WaitForExit(15000);
        } catch (Exception ex) {
            Console.Error.WriteLine("shortcut: " + ex.Message);
        }
    }

    public static void SilentInstall() {
        var target = DefaultPath();
        InstallTo(target);
        File.WriteAllText(Path.Combine(target, "install.log"),
            DateTime.Now + " silent install to " + target);
    }

    public static void Uninstall(string target) {
        try {
            var lnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "学考冲刺通课堂版.lnk");
            if (File.Exists(lnk)) File.Delete(lnk);
            var sm = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "学考冲刺通课堂版.lnk");
            if (File.Exists(sm)) File.Delete(sm);
            if (Directory.Exists(target)) Directory.Delete(target, true);
            MessageBox.Show("已卸载（" + target + " 已删除）", "学考冲刺通");
        } catch (Exception ex) {
            MessageBox.Show("卸载出错：" + ex.Message);
        }
    }
}

class SetupForm : Form {
    TextBox pathBox;
    CheckBox runChk;
    Label status;

    public SetupForm() {
        Text = "学考冲刺通 · 课堂版 安装向导";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new System.Drawing.Size(540, 280);

        var lbl = new Label {
            Text = "福建省中职《信息技术基础》刷题 + 课堂 PK 系统\n\n内置：3982 题题库 · 本地数据库 · 课堂 PK / 擂台赛 · 背景音乐\n安装后桌面与开始菜单出现「学考冲刺通课堂版」快捷方式\n背景音乐：把 mp3/wav 放进安装目录的 music 文件夹即可",
            Left = 20, Top = 15, Width = 500, Height = 85
        };
        Controls.Add(lbl);

        Controls.Add(new Label { Text = "安装位置：", Left = 20, Top = 115, Width = 80 });
        pathBox = new TextBox { Left = 100, Top = 112, Width = 330, Text = Program.DefaultPath() };
        Controls.Add(pathBox);
        var browse = new Button { Text = "浏览…", Left = 440, Top = 110, Width = 70 };
        browse.Click += delegate {
            var dlg = new FolderBrowserDialog { SelectedPath = pathBox.Text };
            if (dlg.ShowDialog() == DialogResult.OK) pathBox.Text = dlg.SelectedPath;
        };
        Controls.Add(browse);

        var installBtn = new Button { Text = "安装", Left = 100, Top = 155, Width = 120, Height = 35 };
        installBtn.Click += delegate { DoInstall(); };
        Controls.Add(installBtn);

        runChk = new CheckBox { Text = "安装完成后立即启动", Left = 240, Top = 160, Width = 200, Checked = true };
        Controls.Add(runChk);

        status = new Label { Text = "", Left = 20, Top = 210, Width = 500 };
        Controls.Add(status);
    }

    void DoInstall() {
        try {
            status.Text = "正在安装…";
            var target = pathBox.Text.Trim();
            Program.InstallTo(target);
            status.Text = "安装完成：" + target;
            MessageBox.Show("安装完成！桌面出现「学考冲刺通课堂版」快捷方式。\n\n背景音乐：把 mp3/wav 放进 " + Path.Combine(target, "music") + " 文件夹即可。", "学考冲刺通");
            if (runChk.Checked) {
                try { Process.Start(Path.Combine(target, "学考冲刺通.exe")); } catch (Exception ex) { MessageBox.Show("启动失败：" + ex.Message); }
            }
            Close();
        } catch (Exception ex) {
            status.Text = "";
            MessageBox.Show("安装出错：" + ex.Message, "学考冲刺通");
        }
    }
}
