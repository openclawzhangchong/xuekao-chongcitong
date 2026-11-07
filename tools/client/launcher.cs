using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

/* 学考冲刺通 · 课堂版 启动器（托盘常驻）
 * 职责：启动内嵌 Python 的班级版服务（本地数据库/音乐/题库）→ 打开 Edge 应用窗口
 * 退出托盘即停止服务。单实例。C#5 语法（本机 csc 直接编译，零外部依赖）。 */

static class Program {
    [STAThread]
    static void Main() {
        bool createdNew;
        var mutex = new Mutex(true, "XueKaoKeTangBan", out createdNew);
        if (!createdNew) {
            MessageBox.Show("课堂版已在运行（任务栏右下角托盘图标）", "学考冲刺通");
            return;
        }
        Application.EnableVisualStyles();
        Application.Run(new TrayContext());
        GC.KeepAlive(mutex);
    }
}

class TrayContext : ApplicationContext {
    const int PORT = 8953;
    const string URL = "http://127.0.0.1:8953/?client=1";
    const string TEACHER_URL = "http://127.0.0.1:8953/teacher";
    Process server;
    NotifyIcon tray;
    string root = AppDomain.CurrentDomain.BaseDirectory;

    public TrayContext() {
        var menu = new ContextMenu();
        menu.MenuItems.Add("打开主界面", delegate { OpenApp(); });
        menu.MenuItems.Add("教师学情页（本机）", delegate { OpenUrl(TEACHER_URL); });
        menu.MenuItems.Add("数据文件夹", delegate { OpenDataFolder(); });
        menu.MenuItems.Add(new MenuItem("-"));
        menu.MenuItems.Add("退出并停止服务", delegate { ExitAll(); });
        tray = new NotifyIcon();
        tray.Icon = LoadIcon();
        tray.Text = "学考冲刺通 · 课堂版";
        tray.ContextMenu = menu;
        tray.Visible = true;
        tray.DoubleClick += delegate { OpenApp(); };
        StartServerAndOpen();
    }

    Icon LoadIcon() {
        try { return new Icon(Path.Combine(root, "icon.ico")); } catch { }
        return SystemIcons.Application;
    }

    bool ServerAlive() {
        try {
            using (var c = new TcpClient()) {
                var r = c.BeginConnect("127.0.0.1", PORT, null, null);
                if (!r.AsyncWaitHandle.WaitOne(800, false)) return false;
                c.EndConnect(r);
                return true;
            }
        } catch { return false; }
    }

    void StartServerAndOpen() {
        if (!ServerAlive()) {
            var py = Path.Combine(root, "python", "pythonw.exe");
            if (!File.Exists(py)) py = "pythonw.exe";   // 兜底：系统 Python
            var script = Path.Combine(root, "server.py");
            var psi = new ProcessStartInfo(py, "-I \"" + script + "\"");
            psi.WorkingDirectory = root;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            server = Process.Start(psi);
            for (int i = 0; i < 30 && !ServerAlive(); i++) Thread.Sleep(500);
        }
        OpenApp();
        tray.ShowBalloonTip(2000, "学考冲刺通 · 课堂版", "服务已就绪，主界面已打开", ToolTipIcon.Info);
    }

    void OpenApp() {
        var candidates = new string[] {
            @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            @"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
        };
        foreach (var e in candidates) {
            if (File.Exists(e)) {
                Process.Start(e, "--app=" + URL);
                return;
            }
        }
        OpenUrl(URL);   // 兜底：默认浏览器
    }

    void OpenUrl(string u) {
        try { Process.Start(u); } catch { }
    }

    void OpenDataFolder() {
        try {
            var d = Path.Combine(root, "data");
            if (!Directory.Exists(d)) Directory.CreateDirectory(d);
            Process.Start("explorer.exe", d);
        } catch { }
    }

    void ExitAll() {
        try {
            if (server != null && !server.HasExited) server.Kill();
        } catch { }
        tray.Visible = false;
        Application.Exit();
    }
}
