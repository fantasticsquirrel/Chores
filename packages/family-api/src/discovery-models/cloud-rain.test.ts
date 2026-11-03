import { describe, expect, it } from "vitest";
import {
  cloudRainTrials,
  cloudResult,
  CLOUD_MAX_LIFT_M,
  defaultCloudState,
  FALLING_PARTICLE_DIAMETER_UM,
  normalizeCloud,
  RAIN_DIAMETER_UM,
  saturationVaporPressureHpa,
} from "./cloud-rain";

describe("bounded cloud formation model", () => {
  it("separates invisible vapor, visible cloud droplets, virga and rain at ground", () => {
    expect(cloudResult({ ...defaultCloudState, upliftM: 0 }).outcome).toBe(
      "invisible-vapor",
    );
    expect(cloudResult(defaultCloudState).outcome).toBe("cloud-droplets");
    expect(
      cloudResult({
        ...defaultCloudState,
        particleDiameterUm: 1_000,
        subcloudRelativeHumidityPercent: 20,
      }).outcome,
    ).toBe("virga");
    expect(
      cloudResult({
        ...defaultCloudState,
        particleDiameterUm: 1_000,
        subcloudRelativeHumidityPercent: 80,
      }).outcome,
    ).toBe("rain-at-ground");
  });

  it("raises relative humidity during lift and condenses only after saturation", () => {
    const low = cloudResult({ ...defaultCloudState, upliftM: 400 });
    const high = cloudResult({ ...defaultCloudState, upliftM: 1_600 });
    expect(low.cloud).toBe(false);
    expect(low.parcelRelativeHumidityPercent).toBeGreaterThan(60);
    expect(low.parcelRelativeHumidityPercent).toBeLessThan(100);
    expect(low.condensedWaterGPerKg).toBe(0);
    expect(high.cloud).toBe(true);
    expect(high.parcelRelativeHumidityPercent).toBe(100);
    expect(high.condensedWaterGPerKg).toBeGreaterThan(0);
    expect(high.parcelTemperatureC).toBeLessThan(low.parcelTemperatureC);
  });

  it("responds to temperature and starting relative humidity without saying air holds water", () => {
    const dry = cloudResult({
      ...defaultCloudState,
      relativeHumidityPercent: 30,
    });
    const humid = cloudResult({
      ...defaultCloudState,
      relativeHumidityPercent: 95,
    });
    const warmer = cloudResult({ ...defaultCloudState, temperatureC: 32 });
    expect(humid.condensationHeightM).toBeLessThan(dry.condensationHeightM);
    expect(warmer.startingVaporMixingRatioGPerKg).toBeGreaterThan(
      cloudResult(defaultCloudState).startingVaporMixingRatioGPerKg,
    );
    expect(saturationVaporPressureHpa(30)).toBeGreaterThan(
      saturationVaporPressureHpa(20),
    );
  });

  it("uses diameter and subcloud humidity as independent precipitation controls", () => {
    const cloudDrop = cloudResult({
      ...defaultCloudState,
      particleDiameterUm: 20,
    });
    const rainDrop = cloudResult({
      ...defaultCloudState,
      particleDiameterUm: 1_000,
    });
    const saturatedBelow = cloudResult({
      ...defaultCloudState,
      particleDiameterUm: 1_000,
      subcloudRelativeHumidityPercent: 100,
    });
    expect(cloudDrop.fallingPrecipitation).toBe(false);
    expect(rainDrop.fallingPrecipitation).toBe(true);
    expect(rainDrop.groundParticleDiameterUm).toBeGreaterThanOrEqual(
      RAIN_DIAMETER_UM,
    );
    expect(saturatedBelow.groundParticleDiameterUm).toBe(1_000);
    expect(rainDrop.particleVolumeRatioToCloudDroplet).toBe(125_000);
  });

  it("uses one coherent saturation crossing for RH, cloud and condensate", () => {
    for (const temperatureC of [22, 24, 32])
      for (const relativeHumidityPercent of [30, 60, 95]) {
        const probe = cloudResult({
          ...defaultCloudState,
          temperatureC,
          relativeHumidityPercent,
          upliftM: 0,
        });
        const baseM = probe.condensationHeightM;
        if (baseM >= CLOUD_MAX_LIFT_M) {
          const boundedTop = cloudResult({
            ...defaultCloudState,
            temperatureC,
            relativeHumidityPercent,
            upliftM: CLOUD_MAX_LIFT_M,
          });
          expect(boundedTop.saturated).toBe(false);
          expect(boundedTop.cloud).toBe(false);
          expect(boundedTop.condensedWaterGPerKg).toBe(0);
          expect(boundedTop.parcelRelativeHumidityPercent).toBeLessThan(100);
          continue;
        }

        const epsilonM = 0.001;
        const below = cloudResult({
          ...defaultCloudState,
          temperatureC,
          relativeHumidityPercent,
          upliftM: baseM - epsilonM,
        });
        const at = cloudResult({
          ...defaultCloudState,
          temperatureC,
          relativeHumidityPercent,
          upliftM: baseM,
          particleDiameterUm: 1_000,
        });
        const above = cloudResult({
          ...defaultCloudState,
          temperatureC,
          relativeHumidityPercent,
          upliftM: baseM + epsilonM,
        });
        expect(below.saturated).toBe(false);
        expect(below.parcelRelativeHumidityPercent).toBeLessThan(100);
        expect(below.cloud).toBe(false);
        expect(below.condensedWaterGPerKg).toBe(0);
        expect(at.saturated).toBe(true);
        expect(at.parcelRelativeHumidityPercent).toBe(100);
        expect(at.cloud).toBe(false);
        expect(at.condensedWaterGPerKg).toBe(0);
        expect(at.fallingPrecipitation).toBe(false);
        expect(above.saturated).toBe(true);
        expect(above.parcelRelativeHumidityPercent).toBe(100);
        expect(above.cloud).toBe(true);
        expect(above.condensedWaterGPerKg).toBeGreaterThan(0);
      }
  });

  it("calls only complete below-cloud evaporation virga", () => {
    const survivesBelowTeachingThreshold = cloudResult({
      ...defaultCloudState,
      particleDiameterUm: 200,
      subcloudRelativeHumidityPercent: 99,
    });
    expect(
      survivesBelowTeachingThreshold.groundParticleDiameterUm,
    ).toBeGreaterThan(0);
    expect(
      survivesBelowTeachingThreshold.groundParticleDiameterUm,
    ).toBeLessThan(FALLING_PARTICLE_DIAMETER_UM);
    expect(survivesBelowTeachingThreshold.groundPrecipitation).toBe(true);
    expect(survivesBelowTeachingThreshold.virga).toBe(false);
    expect(survivesBelowTeachingThreshold.outcome).toBe("drizzle-at-ground");

    const fullyEvaporated = cloudResult({
      ...defaultCloudState,
      particleDiameterUm: 1_000,
      subcloudRelativeHumidityPercent: 20,
    });
    expect(fullyEvaporated.groundParticleDiameterUm).toBe(0);
    expect(fullyEvaporated.groundPrecipitation).toBe(false);
    expect(fullyEvaporated.virga).toBe(true);
  });

  it("keeps every normalized cross-product finite and physically ordered", () => {
    for (const temperatureC of [22, 24, 32])
      for (const relativeHumidityPercent of [30, 60, 95])
        for (const upliftM of [0, 400, 1_600, CLOUD_MAX_LIFT_M])
          for (const particleDiameterUm of [10, 20, 200, 500, 2_000])
            for (const subcloudRelativeHumidityPercent of [20, 80, 100]) {
              const result = cloudResult({
                temperatureC,
                relativeHumidityPercent,
                upliftM,
                particleDiameterUm,
                subcloudRelativeHumidityPercent,
              });
              for (const value of Object.values(result))
                if (typeof value === "number")
                  expect(Number.isFinite(value)).toBe(true);
              expect(
                result.parcelRelativeHumidityPercent,
              ).toBeGreaterThanOrEqual(0);
              expect(result.parcelRelativeHumidityPercent).toBeLessThanOrEqual(
                100,
              );
              expect(result.condensedWaterGPerKg).toBeGreaterThanOrEqual(0);
              if (result.cloud) {
                expect(result.saturated).toBe(true);
                expect(result.condensedWaterGPerKg).toBeGreaterThan(0);
              }
              if (result.virga) expect(result.groundParticleDiameterUm).toBe(0);
              if (result.groundParticleDiameterUm > 0)
                expect(result.groundPrecipitation).toBe(true);
              expect(result.groundParticleDiameterUm).toBeLessThanOrEqual(
                particleDiameterUm,
              );
              if (particleDiameterUm < FALLING_PARTICLE_DIAMETER_UM)
                expect(result.fallingPrecipitation).toBe(false);
            }
  });

  it("bounds nonfinite inputs and defines two exact one-change trials", () => {
    expect(
      normalizeCloud({
        temperatureC: Number.NaN,
        relativeHumidityPercent: Number.POSITIVE_INFINITY,
        upliftM: -1,
        particleDiameterUm: 9_000,
        subcloudRelativeHumidityPercent: 0,
      }),
    ).toEqual({
      temperatureC: 24,
      relativeHumidityPercent: 60,
      upliftM: 0,
      particleDiameterUm: 2_000,
      subcloudRelativeHumidityPercent: 20,
    });
    expect(cloudRainTrials).toHaveLength(2);
    for (const trial of cloudRainTrials) {
      const changes = (
        Object.keys(trial.before) as (keyof typeof trial.before)[]
      ).filter((key) => trial.before[key] !== trial.after[key]);
      expect(changes).toHaveLength(1);
      expect(trial.correctChoice).toBeTruthy();
      expect(trial.evidence).toMatch(/°C|µm/);
      expect(trial.held.length).toBeGreaterThanOrEqual(4);
    }
  });
});
