package com.wifiheatmap

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.wifi.ScanResult
import android.net.wifi.WifiManager
import android.net.wifi.rtt.RangingRequest
import android.net.wifi.rtt.RangingResult
import android.net.wifi.rtt.RangingResultCallback
import android.net.wifi.rtt.WifiRttManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.Executor
import java.util.concurrent.Executors

@ReactModule(name = WifiRttModule.NAME)
class WifiRttModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val executor: Executor = Executors.newSingleThreadExecutor()
    companion object {
        const val NAME = "WifiRtt"
        // Maximum number of APs to include in a single ranging request
        private const val MAX_RTT_APS_PER_REQUEST = 10
    }

    private val wifiManager = reactContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    private val rttManager: WifiRttManager? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
            reactContext.getSystemService(Context.WIFI_RTT_RANGING_SERVICE) as? WifiRttManager
        else null

    override fun getName(): String = NAME

    @ReactMethod
    fun isRttAvailable(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && rttManager != null) {
            promise.resolve(rttManager.isAvailable)
        } else {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun scanWifiNetworks(promise: Promise) {
        if (ActivityCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("PERMISSION_DENIED", "Location permission is required")
            return
        }
        val filter = IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION)
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                try {
                    reactApplicationContext.unregisterReceiver(this)
                } catch (e: IllegalArgumentException) {
                    // Ignore if already unregistered
                }

                try {
                    val scanResultsAvailable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
                        intent?.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false) ?: false
                    } else {
                        true
                    }

                    if (WifiManager.SCAN_RESULTS_AVAILABLE_ACTION == intent?.action && scanResultsAvailable) {
                        val results = wifiManager.scanResults
                        val array = Arguments.createArray()
                        for (result in results) {
                            val map = Arguments.createMap()
                            map.putString("ssid", result.SSID)
                            map.putString("bssid", result.BSSID)
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                map.putBoolean("is80211mcResponder", result.is80211mcResponder)
                            } else {
                                map.putBoolean("is80211mcResponder", false)
                            }
                            map.putInt("frequency", result.frequency)
                            map.putInt("level", result.level)
                            map.putInt("channelWidth", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) result.channelWidth else 0)
                            map.putInt("centerFreq0", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) result.centerFreq0 else 0)
                            array.pushMap(map)
                        }
                        promise.resolve(array)
                    } else {
                         val results = wifiManager.scanResults
                         if (results != null && results.isNotEmpty()) {
                            val array = Arguments.createArray()
                            for (result in results) {
                                val map = Arguments.createMap()
                                map.putString("ssid", result.SSID)
                                map.putString("bssid", result.BSSID)
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                    map.putBoolean("is80211mcResponder", result.is80211mcResponder)
                                } else {
                                    map.putBoolean("is80211mcResponder", false)
                                }
                                map.putInt("frequency", result.frequency)
                                map.putInt("level", result.level)
                                map.putInt("channelWidth", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) result.channelWidth else 0)
                                map.putInt("centerFreq0", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) result.centerFreq0 else 0)
                                array.pushMap(map)
                            }
                            promise.resolve(array)
                         } else {
                            promise.resolve(Arguments.createArray())
                         }
                    }
                } catch (e: SecurityException) {
                    promise.reject("SCAN_ERROR", "Failed to get scan results: ${e.message}")
                } catch (e: Exception) {
                     promise.reject("SCAN_ERROR", "An unexpected error occurred during scan: ${e.message}")
                }
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                 reactApplicationContext.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                 reactApplicationContext.registerReceiver(receiver, filter)
            }
        } catch (e: Exception) {
            promise.reject("REGISTER_ERROR", "Failed to register broadcast receiver: ${e.message}")
            return
        }

        val scanStarted = try {
            wifiManager.startScan()
        } catch (e: Exception) {
            try { reactApplicationContext.unregisterReceiver(receiver) } catch (e: Exception) {}
            promise.reject("SCAN_INIT_FAILED", "Exception during startScan: ${e.message}")
            return
        }

        if (!scanStarted) {
             try { reactApplicationContext.unregisterReceiver(receiver) } catch (e: Exception) {}
             promise.reject("SCAN_INIT_FAILED", "Failed to start WiFi scan (possibly throttled).")
        }
    }

    @ReactMethod
    fun startRanging(bssid: String, promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P || rttManager == null) {
            promise.reject("RTT_UNSUPPORTED", "WiFi RTT is not supported on this device or service is unavailable")
            return
        }
        if (ActivityCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("PERMISSION_DENIED", "Location permission is required for ranging")
            return
        }

        val scanResult: ScanResult? = try {
             wifiManager.scanResults.find { it.BSSID == bssid }
        } catch (e: SecurityException) {
             promise.reject("SCAN_ERROR", "Failed to get scan results for ranging: ${e.message}")
             return
        } catch (e: Exception) {
             promise.reject("SCAN_ERROR", "An unexpected error occurred getting scan results for ranging: ${e.message}")
             return
        }

        if (scanResult == null) {
            promise.reject("NO_AP", "Access point $bssid not found in current scan results.")
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !scanResult.is80211mcResponder) {
             promise.reject("AP_RTT_UNSUPPORTED", "Access point $bssid does not support WiFi RTT.")
             return
        }

        val request = RangingRequest.Builder().addAccessPoint(scanResult).build()

        rttManager.startRanging(request, this.executor, object : RangingResultCallback() {
            override fun onRangingFailure(code: Int) {
                promise.reject("RTT_ERROR", "Ranging failed with code $code. See RangingResultCallback documentation for details.")
            }
            override fun onRangingResults(results: List<RangingResult>) {
                val array = Arguments.createArray()
                for (result in results) {
                    if (result.status == RangingResult.STATUS_SUCCESS) {
                        val map = Arguments.createMap()
                        map.putString("bssid", result.macAddress.toString())
                        map.putInt("distanceMm", result.distanceMm)
                        map.putInt("distanceStdDevMm", result.distanceStdDevMm)
                        map.putInt("rssi", result.rssi)
                        // Calculate signal quality based on both RSSI and distance
                        val signalQuality = calculateSignalQuality(result.rssi, result.distanceMm)
                        map.putDouble("signalQuality", signalQuality)
                        array.pushMap(map)
                    }
                }
                promise.resolve(array)
            }
        })
    }
    
    @ReactMethod
    fun startMultipleRanging(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P || rttManager == null) {
            promise.reject("RTT_UNSUPPORTED", "WiFi RTT is not supported on this device or service is unavailable")
            return
        }
        if (ActivityCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("PERMISSION_DENIED", "Location permission is required for ranging")
            return
        }
        
        val scanResults = try {
            wifiManager.scanResults.filter { 
                Build.VERSION.SDK_INT < Build.VERSION_CODES.M || it.is80211mcResponder 
            }.take(MAX_RTT_APS_PER_REQUEST)
        } catch (e: SecurityException) {
            promise.reject("SCAN_ERROR", "Failed to get scan results for ranging: ${e.message}")
            return
        } catch (e: Exception) {
            promise.reject("SCAN_ERROR", "An unexpected error occurred getting scan results for ranging: ${e.message}")
            return
        }
        
        if (scanResults.isEmpty()) {
            promise.reject("NO_RTT_APS", "No RTT-capable access points found in scan results.")
            return
        }
        
        val requestBuilder = RangingRequest.Builder()
        scanResults.forEach { requestBuilder.addAccessPoint(it) }
        val request = requestBuilder.build()
        
        rttManager.startRanging(request, this.executor, object : RangingResultCallback() {
            override fun onRangingFailure(code: Int) {
                promise.reject("RTT_ERROR", "Ranging failed with code $code. See RangingResultCallback documentation for details.")
            }
            override fun onRangingResults(results: List<RangingResult>) {
                val array = Arguments.createArray()
                for (result in results) {
                    if (result.status == RangingResult.STATUS_SUCCESS) {
                        val map = Arguments.createMap()
                        map.putString("bssid", result.macAddress.toString())
                        map.putInt("distanceMm", result.distanceMm)
                        map.putInt("distanceStdDevMm", result.distanceStdDevMm)
                        map.putInt("rssi", result.rssi)
                        // Calculate signal quality based on both RSSI and distance
                        val signalQuality = calculateSignalQuality(result.rssi, result.distanceMm)
                        map.putDouble("signalQuality", signalQuality)
                        array.pushMap(map)
                    }
                }
                promise.resolve(array)
            }
        })
    }
    
    /**
     * Calculate a signal quality metric that combines RSSI and distance
     * Returns a value between 0 (worst) and 1 (best)
     */
    private fun calculateSignalQuality(rssi: Int, distanceMm: Int): Double {
        // Normalize RSSI from typical range (-100 to -30) to 0-1
        val normalizedRssi = (rssi + 100) / 70.0
        val clampedRssi = normalizedRssi.coerceIn(0.0, 1.0)
        
        // Normalize distance (0 to 50m) to 0-1 (inverted, so closer is better)
        val distanceM = distanceMm / 1000.0
        val normalizedDistance = 1.0 - (distanceM / 50.0).coerceIn(0.0, 1.0)
        
        // Weighted combination (giving more weight to RSSI for signal strength)
        return (0.7 * clampedRssi) + (0.3 * normalizedDistance)
    }
}