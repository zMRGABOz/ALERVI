"""
Script de ejecución automatizada y certificación de carga con Locust.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Verifica contra Supabase real:
- Cálculo on-the-fly de >2000 puntos en /ranking
- Evaluación cinemática PostGIS en /alerts
- Throughput global >= 50 req/s
- Percentil 95 (p95) <= 800 ms
- Error rate == 0%
"""

import csv
import json
import os
import subprocess
import sys
import time
from pathlib import Path


def main():
    base_dir = Path(__file__).resolve().parent
    reports_dir = base_dir / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    csv_prefix = reports_dir / "benchmark"

    # Limpiar reportes previos
    for p in reports_dir.glob("benchmark*"):
        try:
            p.unlink()
        except Exception:
            pass

    host = os.getenv("TARGET_HOST", "http://127.0.0.1:8000")
    users = int(os.getenv("LOCUST_USERS", "25"))
    spawn_rate = int(os.getenv("LOCUST_SPAWN_RATE", "10"))
    run_time = os.getenv("LOCUST_RUN_TIME", "40s")

    print(f"=== Iniciando Benchmark Locust contra {host} ===")
    print(f"Usuarios: {users} | Spawn rate: {spawn_rate}/s | Duración: {run_time}")

    cmd = [
        sys.executable,
        "-m",
        "locust",
        "-f",
        str(base_dir / "locustfile.py"),
        "--headless",
        "-u",
        str(users),
        "-r",
        str(spawn_rate),
        "--run-time",
        run_time,
        "--host",
        host,
        "--csv",
        str(csv_prefix),
        "--csv-full-history",
    ]

    time.time()
    proc = subprocess.run(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    time.time()
    print(proc.stdout)

    stats_csv = reports_dir / "benchmark_stats.csv"
    if not stats_csv.is_file():
        print(f"ERROR: No se encontró el archivo de estadísticas {stats_csv}")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("RESUMEN DE MÉTRICAS OBTENIDAS:")
    print("=" * 70)

    rows = []
    with open(stats_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    total_row = None
    endpoint_rows = []
    for r in rows:
        name = r.get("Name", "")
        if name == "Aggregated":
            total_row = r
        else:
            endpoint_rows.append(r)

    results = []
    all_passed = True

    print(
        f"{'Endpoint':<45} | {'Req/s':<8} | {'p50':<8} | {'p90':<8} | {'p95':<8} | {'p99':<8} | {'Fails':<6}"
    )
    print("-" * 105)

    for r in rows:
        name = r.get("Name", "")
        req_count = int(r.get("Request Count", 0))
        fail_count = int(r.get("Failure Count", 0))
        rps = float(r.get("Requests/s", 0.0))
        p50 = float(r.get("50%", 0.0))
        p90 = float(r.get("90%", 0.0))
        p95 = float(r.get("95%", 0.0))
        p99 = float(r.get("99%", 0.0))

        print(
            f"{name:<45} | {rps:<8.1f} | {p50:<8.1f} | {p90:<8.1f} | {p95:<8.1f} | {p99:<8.1f} | {fail_count:<6}"
        )

        if name != "Aggregated":
            passed = (p95 <= 800.0) and (fail_count == 0)
            if not passed:
                all_passed = False
            results.append(
                {
                    "name": name,
                    "requests": req_count,
                    "failures": fail_count,
                    "rps": rps,
                    "p50": p50,
                    "p90": p90,
                    "p95": p95,
                    "p99": p99,
                    "passed": passed,
                }
            )

    if total_row:
        total_rps = float(total_row.get("Requests/s", 0.0))
        total_p95 = float(total_row.get("95%", 0.0))
        total_fails = int(total_row.get("Failure Count", 0))
        total_reqs = int(total_row.get("Request Count", 0))
        fail_pct = (total_fails / total_reqs * 100.0) if total_reqs > 0 else 0.0

        print("=" * 105)
        print(
            f"Total Requests: {total_reqs} | Throughput: {total_rps:.1f} req/s | Total Fails: {total_fails} ({fail_pct:.2f}%)"
        )
        print(f"Global p95 Latency: {total_p95:.1f} ms")

        # Criterios de Aceptación
        req_s_ok = total_rps >= 50.0
        p95_ok = total_p95 <= 800.0
        fails_ok = total_fails == 0

        print("\n=== EVALUACIÓN DE CRITERIOS SRS ===")
        print(
            f"1. Throughput >= 50 req/s:          {'PASÓ (' + str(round(total_rps, 1)) + ' req/s)' if req_s_ok else 'FALLÓ'}"
        )
        print(
            f"2. Latencia p95 <= 800 ms global:    {'PASÓ (' + str(round(total_p95, 1)) + ' ms)' if p95_ok else 'FALLÓ'}"
        )
        print(
            f"3. Latencia p95 <= 800 ms endpoints: {'PASÓ' if all_passed else 'FALLÓ'}"
        )
        print(
            f"4. Tasa de errores = 0%:             {'PASÓ (' + str(total_fails) + ' fallos)' if fails_ok else 'FALLÓ'}"
        )

        cert = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "host": host,
            "total_requests": total_reqs,
            "total_rps": total_rps,
            "total_p95": total_p95,
            "total_fails": total_fails,
            "criteria": {
                "throughput_ge_50": req_s_ok,
                "p95_le_800": p95_ok,
                "zero_failures": fails_ok,
                "endpoints_p95_le_800": all_passed,
                "srs_certified": req_s_ok and p95_ok and fails_ok and all_passed,
            },
            "endpoints": results,
        }

        with open(
            reports_dir / "certification_summary.json", "w", encoding="utf-8"
        ) as f:
            json.dump(cert, f, indent=2)

        if req_s_ok and p95_ok and fails_ok and all_passed:
            print(
                "\n>>> CERTIFICACIÓN SRS EXITOSA: Todos los criterios fueron satisfechos. <<<"
            )
            sys.exit(0)
        else:
            print(
                "\n>>> FALLO EN CERTIFICACIÓN SRS: Uno o más criterios no fueron satisfechos. <<<"
            )
            sys.exit(2)


if __name__ == "__main__":
    main()
