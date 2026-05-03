import argparse
import logging
import sqlite3
import warnings
from datetime import datetime
from pathlib import Path

warnings.filterwarnings("ignore")

logging.getLogger("prophet").setLevel(logging.CRITICAL)
logging.getLogger("cmdstanpy").setLevel(logging.CRITICAL)

import numpy as np
import pandas as pd

from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.neural_network import MLPRegressor
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
import lightgbm as lgb

# -----------------------------
# Prophet
# -----------------------------
PROPHET_AVAILABLE = False
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    try:
        from fbprophet import Prophet
        PROPHET_AVAILABLE = True
    except ImportError:
        print("Prophet not found. Prophet will be skipped.")

# -----------------------------
# Configuration
# -----------------------------
db_path = r"C:\Users\alsen\Desktop\dss_dashboard_project\dss_inventory_demo.db"
configured_item_ids = [100, 103, 105, 106, 107, 109]
forecast_horizon = 3
receipts_col = "Receipts_qty"
item_date_cutoffs = {
    100: "2026-04-08",
    103: "2026-04-08",
}


# -----------------------------
# Load data from active dashboard DB
# -----------------------------
def get_active_dataset_id(conn):
    row = conn.execute(
        """
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
        """
    ).fetchone()

    if row is None:
        raise ValueError("No active dataset found in dashboard database")

    return row[0]


def load_data_from_sqlite(conn, item_ids=None):
    active_dataset_id = get_active_dataset_id(conn)
    params = [active_dataset_id]
    item_filter = ""

    if item_ids:
        placeholders = ",".join("?" for _ in item_ids)
        item_filter = f"AND CAST(ri.item_id AS INTEGER) IN ({placeholders})"
        params.extend(item_ids)

    df = pd.read_sql_query(
        f"""
        SELECT
            date(ri.date) AS Date,
            CAST(ri.item_id AS INTEGER) AS Item_ID,
            COALESCE(ri.issues_qty, 0) AS issues_qty,
            COALESCE(ri.receipts_qty, 0) AS Receipts_qty,
            COALESCE(ri.closing_qty, 0) AS closing_qty,
            COALESCE(ri.avg_usage_per_day, 0) AS Avg_Usage_Per_Day
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = ?
          AND ri.item_id IS NOT NULL
          AND ri.date IS NOT NULL
          AND NOT (
              CAST(ri.item_id AS INTEGER) IN (100, 103)
              AND date(ri.date) >= date('2026-04-08')
          )
          {item_filter}
        ORDER BY date(ri.date), CAST(ri.item_id AS INTEGER)
        """,
        conn,
        params=params,
    )

    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df["Item_ID"] = pd.to_numeric(df["Item_ID"], errors="coerce")
    df = df.dropna(subset=["Date", "Item_ID"])

    return active_dataset_id, df


# -----------------------------
# Metrics
# -----------------------------
def calculate_metrics(y_true, y_pred, model_name):
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)

    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)

    wape = (np.sum(np.abs(y_true - y_pred)) / (np.sum(np.abs(y_true)) + 1e-8)) * 100
    r2 = r2_score(y_true, y_pred) if len(y_true) > 1 else np.nan

    selection_score = wape - (r2 * 10)

    return {
        "Model": model_name,
        "RMSE": rmse,
        "MAE": mae,
        "WAPE_%": wape,
        "R2": r2,
        "Selection_Score": selection_score
    }


# -----------------------------
# Monthly data
# -----------------------------
def build_monthly_item_data(item_df):
    monthly = (
        item_df.set_index("Date")
        .resample("ME")
        .agg({
            "issues_qty": "sum",
            receipts_col: "sum",
            "closing_qty": "mean",
            "Avg_Usage_Per_Day": "mean"
        })
    )

    monthly["issues_qty"] = monthly["issues_qty"].fillna(0)
    monthly[receipts_col] = monthly[receipts_col].fillna(0)

    monthly["closing_qty"] = monthly["closing_qty"].interpolate().bfill().ffill().fillna(0)
    monthly["Avg_Usage_Per_Day"] = monthly["Avg_Usage_Per_Day"].interpolate().bfill().ffill().fillna(0)

    monthly = monthly.reset_index()

    monthly["target_nosmooth"] = monthly["issues_qty"]
    monthly["target_smooth"] = monthly["issues_qty"].rolling(window=2, min_periods=1).mean()

    monthly["trend"] = np.arange(len(monthly))
    monthly["month"] = monthly["Date"].dt.month
    monthly["quarter"] = monthly["Date"].dt.quarter
    monthly["month_sin"] = np.sin(2 * np.pi * monthly["month"] / 12)
    monthly["month_cos"] = np.cos(2 * np.pi * monthly["month"] / 12)

    return monthly


# -----------------------------
# Features
# -----------------------------
def add_features(monthly, target_col):
    data = monthly.copy()

    data["lag_1"] = data[target_col].shift(1)
    data["lag_2"] = data[target_col].shift(2)
    data["lag_3"] = data[target_col].shift(3)

    data["rolling_mean_2"] = data[target_col].shift(1).rolling(2, min_periods=1).mean()
    data["rolling_std_2"] = data[target_col].shift(1).rolling(2, min_periods=1).std()
    data["rolling_min_2"] = data[target_col].shift(1).rolling(2, min_periods=1).min()
    data["rolling_max_2"] = data[target_col].shift(1).rolling(2, min_periods=1).max()

    data["rolling_mean_3"] = data[target_col].shift(1).rolling(3, min_periods=1).mean()
    data["rolling_std_3"] = data[target_col].shift(1).rolling(3, min_periods=1).std()

    data["diff_1"] = data[target_col].diff(1)

    data["lag_1"] = data["lag_1"].fillna(data[target_col])
    data["lag_2"] = data["lag_2"].fillna(data["lag_1"])
    data["lag_3"] = data["lag_3"].fillna(data["lag_2"])

    data["rolling_mean_2"] = data["rolling_mean_2"].fillna(data["lag_1"])
    data["rolling_std_2"] = data["rolling_std_2"].fillna(0)
    data["rolling_min_2"] = data["rolling_min_2"].fillna(data["lag_1"])
    data["rolling_max_2"] = data["rolling_max_2"].fillna(data["lag_1"])

    data["rolling_mean_3"] = data["rolling_mean_3"].fillna(data["lag_1"])
    data["rolling_std_3"] = data["rolling_std_3"].fillna(0)

    data["diff_1"] = data["diff_1"].fillna(0)

    return data


# -----------------------------
# ANN
# -----------------------------
def train_ann(X_train, y_train):
    x_scaler = StandardScaler()
    y_scaler = MinMaxScaler()

    X_scaled = x_scaler.fit_transform(X_train)
    y_scaled = y_scaler.fit_transform(y_train.values.reshape(-1, 1)).ravel()

    model = MLPRegressor(
        hidden_layer_sizes=(32, 16),
        activation="relu",
        solver="adam",
        alpha=0.001,
        learning_rate_init=0.001,
        max_iter=5000,
        random_state=42
    )

    model.fit(X_scaled, y_scaled)

    return model, x_scaler, y_scaler


def predict_ann(model, x_scaler, y_scaler, X_test):
    X_scaled = x_scaler.transform(X_test)
    pred_scaled = model.predict(X_scaled).reshape(-1, 1)
    pred = y_scaler.inverse_transform(pred_scaled).ravel()
    return pred


# -----------------------------
# Train model
# -----------------------------
def train_model(model_name, X_train, y_train):
    if model_name == "ANN":
        model, x_scaler, y_scaler = train_ann(X_train, y_train)
        return {"name": "ANN", "model": model, "x_scaler": x_scaler, "y_scaler": y_scaler}

    if model_name == "XGBoost":
        model = XGBRegressor(
            n_estimators=200,
            max_depth=3,
            learning_rate=0.1,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="reg:squarederror",
            random_state=42
        )
        model.fit(X_train, y_train)
        return {"name": "XGBoost", "model": model}

    if model_name == "LightGBM":
        model = lgb.LGBMRegressor(
            objective="regression_l1",
            n_estimators=250,
            learning_rate=0.05,
            num_leaves=10,
            max_depth=4,
            min_child_samples=1,
            random_state=42,
            verbose=-1
        )
        model.fit(X_train, y_train)
        return {"name": "LightGBM", "model": model}

    if model_name == "Random Forest":
        model = RandomForestRegressor(
            n_estimators=400,
            max_depth=5,
            min_samples_split=2,
            min_samples_leaf=1,
            random_state=42
        )
        model.fit(X_train, y_train)
        return {"name": "Random Forest", "model": model}

    raise ValueError(f"Unsupported model: {model_name}")


def predict_model(bundle, X_test):
    if bundle["name"] == "ANN":
        return predict_ann(bundle["model"], bundle["x_scaler"], bundle["y_scaler"], X_test)

    return bundle["model"].predict(X_test)


# -----------------------------
# Future features
# -----------------------------
def make_future_features(history, future_date, target_col, feature_cols):
    values = list(history[target_col].values)

    lag_1 = values[-1] if len(values) >= 1 else 0
    lag_2 = values[-2] if len(values) >= 2 else lag_1
    lag_3 = values[-3] if len(values) >= 3 else lag_2

    last_2 = values[-2:] if len(values) >= 2 else values
    last_3 = values[-3:] if len(values) >= 3 else values

    row = {
        "trend": len(history),
        "month": future_date.month,
        "quarter": future_date.quarter,
        "month_sin": np.sin(2 * np.pi * future_date.month / 12),
        "month_cos": np.cos(2 * np.pi * future_date.month / 12),
        receipts_col: history[receipts_col].iloc[-1],
        "closing_qty": history["closing_qty"].iloc[-1],
        "Avg_Usage_Per_Day": history["Avg_Usage_Per_Day"].iloc[-1],
        "lag_1": lag_1,
        "lag_2": lag_2,
        "lag_3": lag_3,
        "rolling_mean_2": np.mean(last_2) if len(last_2) > 0 else 0,
        "rolling_std_2": np.std(last_2, ddof=1) if len(last_2) > 1 else 0,
        "rolling_min_2": np.min(last_2) if len(last_2) > 0 else 0,
        "rolling_max_2": np.max(last_2) if len(last_2) > 0 else 0,
        "rolling_mean_3": np.mean(last_3) if len(last_3) > 0 else 0,
        "rolling_std_3": np.std(last_3, ddof=1) if len(last_3) > 1 else 0,
        "diff_1": values[-1] - values[-2] if len(values) >= 2 else 0
    }

    return pd.DataFrame([row])[feature_cols]


# -----------------------------
# Future ML forecast
# -----------------------------
def forecast_future_ml(bundle, monthly_full, target_col, feature_cols, horizon):
    history = monthly_full.copy()
    future_rows = []

    last_date = history["Date"].max()
    future_dates = pd.date_range(
        start=last_date + pd.offsets.MonthEnd(1),
        periods=horizon,
        freq="ME"
    )

    for future_date in future_dates:
        X_future = make_future_features(history, future_date, target_col, feature_cols)

        pred = predict_model(bundle, X_future)[0]
        pred = int(round(max(0, pred)))

        future_rows.append({
            "Forecast_Date": future_date,
            "Forecast_Demand": pred
        })

        new_row = {
            "Date": future_date,
            "issues_qty": pred,
            receipts_col: history[receipts_col].iloc[-1],
            "closing_qty": history["closing_qty"].iloc[-1],
            "Avg_Usage_Per_Day": history["Avg_Usage_Per_Day"].iloc[-1],
            "target_nosmooth": pred,
            "target_smooth": pred,
            "trend": len(history),
            "month": future_date.month,
            "quarter": future_date.quarter,
            "month_sin": np.sin(2 * np.pi * future_date.month / 12),
            "month_cos": np.cos(2 * np.pi * future_date.month / 12)
        }

        history = pd.concat([history, pd.DataFrame([new_row])], ignore_index=True)

    return pd.DataFrame(future_rows)


# -----------------------------
# Future Prophet forecast
# -----------------------------
def forecast_future_prophet(monthly_full, target_col, horizon):
    prophet_train = pd.DataFrame({
        "ds": monthly_full["Date"],
        "y": monthly_full[target_col]
    })

    n_changepoints = max(1, min(5, len(prophet_train) - 2))

    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode="additive",
        n_changepoints=n_changepoints
    )

    model.fit(prophet_train)

    future = model.make_future_dataframe(periods=horizon, freq="ME")
    forecast = model.predict(future)

    output = forecast.tail(horizon)[["ds", "yhat"]].copy()
    output = output.rename(columns={"ds": "Forecast_Date", "yhat": "Forecast_Demand"})
    output["Forecast_Demand"] = output["Forecast_Demand"].clip(lower=0)

    return output


def save_forecast_to_sqlite(conn, run_id, dataset_id, item_id, monthly_base, best_predictions, best_model, best_wape, best_r2, future_df):
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rows = []

    for _, row in monthly_base.iterrows():
        if float(row["issues_qty"]) <= 0:
            continue
        rows.append((
            run_id,
            dataset_id,
            int(item_id),
            0,
            pd.Timestamp(row["Date"]).strftime("%Y-%m-%d"),
            "historical",
            float(row["issues_qty"]),
            best_model,
            float(best_wape),
            None if pd.isna(best_r2) else float(best_r2),
            created_at,
        ))

    for _, row in best_predictions.iterrows():
        if best_model not in row or pd.isna(row[best_model]):
            continue
        if float(row[best_model]) <= 0:
            continue
        rows.append((
            run_id,
            dataset_id,
            int(item_id),
            0,
            pd.Timestamp(row["Date"]).strftime("%Y-%m-%d"),
            "prediction",
            float(max(0, row[best_model])),
            best_model,
            float(best_wape),
            None if pd.isna(best_r2) else float(best_r2),
            created_at,
        ))

    for _, row in future_df.iterrows():
        if float(row["Forecast_Demand"]) <= 0:
            continue
        rows.append((
            run_id,
            dataset_id,
            int(item_id),
            0,
            pd.Timestamp(row["Forecast_Date"]).strftime("%Y-%m-%d"),
            "forecast",
            float(row["Forecast_Demand"]),
            best_model,
            float(best_wape),
            None if pd.isna(best_r2) else float(best_r2),
            created_at,
        ))

    conn.executemany(
        """
        INSERT OR REPLACE INTO forecast_results (
            run_id,
            dataset_id,
            item_id,
            location_id,
            point_date,
            point_type,
            demand_qty,
            best_model_name,
            wape,
            r2,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )

    return len(rows)


def parse_item_ids(raw):
    if not raw:
        return None
    return [int(part.strip()) for part in raw.split(",") if part.strip()]


def run_forecast(db_file, selected_item_ids=None):
    conn = sqlite3.connect(db_file)

    try:
        active_dataset_id, df = load_data_from_sqlite(conn, selected_item_ids or configured_item_ids)

        if df.empty:
            raise ValueError("No active rows found in raw_inventory_v for the selected items")

        item_ids = sorted(int(x) for x in df["Item_ID"].dropna().unique())
        run_id = f"{active_dataset_id}:{datetime.now().strftime('%Y-%m-%d')}"

        # Replace today's run so manual and scheduled runs stay fresh.
        conn.execute("DELETE FROM forecast_results WHERE run_id = ?", (run_id,))

        feature_cols = [
            "trend", "month", "quarter",
            "month_sin", "month_cos",
            receipts_col, "closing_qty", "Avg_Usage_Per_Day",
            "lag_1", "lag_2", "lag_3",
            "rolling_mean_2", "rolling_std_2", "rolling_min_2", "rolling_max_2",
            "rolling_mean_3", "rolling_std_3",
            "diff_1"
        ]

        candidate_models = ["ANN", "XGBoost", "LightGBM", "Random Forest"]

        if PROPHET_AVAILABLE:
            candidate_models.append("Prophet")

        all_best_models = []

        for item_id in item_ids:
            item_df = df[df["Item_ID"] == item_id].copy().sort_values("Date")

            if item_df.empty:
                continue

            monthly_base = build_monthly_item_data(item_df)

            if len(monthly_base) < 8:
                continue

            target_options = {
                "target_nosmooth": "Not Smoothed",
                "target_smooth": "Smoothed"
            }

            best_overall = None
            best_predictions = None
            best_target_col = None

            for target_col, target_label in target_options.items():
                monthly = add_features(monthly_base, target_col)

                test_size = max(3, int(len(monthly) * 0.2))

                train_df = monthly.iloc[:-test_size].copy()
                test_df = monthly.iloc[-test_size:].copy()

                X_train = train_df[feature_cols]
                X_test = test_df[feature_cols]

                y_train = train_df[target_col]
                y_test = test_df[target_col]

                predictions = pd.DataFrame({
                    "Date": test_df["Date"],
                    "Actual": test_df["issues_qty"]
                })

                for model_name in candidate_models:
                    try:
                        if model_name == "Prophet":
                            prophet_train = pd.DataFrame({
                                "ds": train_df["Date"],
                                "y": y_train
                            })

                            n_changepoints = max(1, min(5, len(prophet_train) - 2))

                            model = Prophet(
                                yearly_seasonality=True,
                                weekly_seasonality=False,
                                daily_seasonality=False,
                                seasonality_mode="additive",
                                n_changepoints=n_changepoints
                            )

                            model.fit(prophet_train)

                            future = model.make_future_dataframe(periods=len(test_df), freq="ME")
                            forecast = model.predict(future)

                            pred = forecast["yhat"].tail(len(test_df)).values

                        else:
                            bundle = train_model(model_name, X_train, y_train)
                            pred = predict_model(bundle, X_test)

                        pred = np.maximum(pred, 0)

                        row = calculate_metrics(y_test, pred, model_name)
                        row["Smoothing"] = target_label
                        row["Target_Column"] = target_col

                        predictions[model_name] = pred

                        if (
                            best_overall is None
                            or row["Selection_Score"] < best_overall["Selection_Score"]
                            or (
                                np.isclose(row["Selection_Score"], best_overall["Selection_Score"])
                                and row["WAPE_%"] < best_overall["WAPE_%"]
                            )
                            or (
                                np.isclose(row["Selection_Score"], best_overall["Selection_Score"])
                                and np.isclose(row["WAPE_%"], best_overall["WAPE_%"])
                                and row["R2"] > best_overall["R2"]
                            )
                        ):
                            best_overall = row
                            best_predictions = predictions.copy()
                            best_target_col = target_col

                    except Exception:
                        continue

            if best_overall is None:
                continue

            best_model = best_overall["Model"]
            best_wape = best_overall["WAPE_%"]
            best_r2 = best_overall["R2"]

            monthly_full = add_features(monthly_base, best_target_col)

            if best_model == "Prophet":
                future_df = forecast_future_prophet(monthly_full, best_target_col, forecast_horizon)
            else:
                X_full = monthly_full[feature_cols]
                y_full = monthly_full[best_target_col]

                final_bundle = train_model(best_model, X_full, y_full)

                future_df = forecast_future_ml(
                    final_bundle,
                    monthly_full,
                    best_target_col,
                    feature_cols,
                    forecast_horizon
                )

            rows_written = save_forecast_to_sqlite(
                conn,
                run_id,
                active_dataset_id,
                item_id,
                monthly_base,
                best_predictions,
                best_model,
                best_wape,
                best_r2,
                future_df,
            )

            all_best_models.append({
                "Item_ID": item_id,
                "Best_Model": best_model,
                "WAPE_%": best_wape,
                "R2": best_r2,
                "Rows_Written": rows_written
            })

        conn.commit()
        return run_id, active_dataset_id, all_best_models
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run demand forecasting against the active dashboard SQLite database.")
    parser.add_argument("--db", default=db_path, help="Path to dss_inventory_demo.db")
    parser.add_argument("--items", default="", help="Optional comma-separated Item_ID values. Empty means the configured forecast items.")
    args = parser.parse_args()

    run_id, active_dataset_id, all_best_models = run_forecast(
        db_file=Path(args.db),
        selected_item_ids=parse_item_ids(args.items),
    )

    print(f"Forecast run complete: {run_id}")
    print(f"Active dataset: {active_dataset_id}")
    print(f"Items forecasted: {len(all_best_models)}")

    for row in all_best_models:
        print(
            f"Item {row['Item_ID']}: {row['Best_Model']} "
            f"WAPE={row['WAPE_%']:.2f}% R2={row['R2']:.3f} rows={row['Rows_Written']}"
        )
