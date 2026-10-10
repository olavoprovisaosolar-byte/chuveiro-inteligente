package expo.modules.solardurablebackup

import android.app.backup.BackupManager
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private const val BACKUP_FILE_NAME = "solar-calculator-backup.json"
private const val RELATIVE_PATH = "Download/SolarCalculator/"

class SolarDurableBackupModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SolarDurableBackup")

    Function("requestSystemBackup") {
      val context = appContext.reactContext ?: return@Function false
      BackupManager(context).dataChanged()
      true
    }

    Function("writePublicBackup") { json: String ->
      val context = appContext.reactContext ?: return@Function "interno"
      writePublic(context, json)
    }

    Function("readPublicBackup") {
      val context = appContext.reactContext ?: return@Function null
      readPublic(context)
    }
  }
}

private fun writePublic(context: Context, json: String): String {
  val mediaOk = writeMediaStore(context, json)
  val fileOk = writeLegacyDownload(json)
  return when {
    mediaOk && fileOk -> "downloads"
    mediaOk -> "mediastore"
    fileOk -> "arquivo"
    else -> "interno"
  }
}

private fun writeMediaStore(context: Context, json: String): Boolean {
  if (Build.VERSION.SDK_INT < 29) return false
  return try {
    val resolver = context.contentResolver
    val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
    val selection = "${MediaStore.MediaColumns.DISPLAY_NAME}=? AND ${MediaStore.MediaColumns.RELATIVE_PATH}=?"
    val args = arrayOf(BACKUP_FILE_NAME, RELATIVE_PATH)
    val pending = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, BACKUP_FILE_NAME)
      put(MediaStore.MediaColumns.MIME_TYPE, "application/json")
      put(MediaStore.MediaColumns.RELATIVE_PATH, RELATIVE_PATH)
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val existing = resolver.query(
      collection,
      arrayOf(MediaStore.MediaColumns._ID),
      selection,
      args,
      null,
    )?.use { cursor ->
      if (!cursor.moveToFirst()) null
      else ContentUris.withAppendedId(collection, cursor.getLong(0))
    }
    val uri = if (existing == null) {
      resolver.insert(collection, pending)
    } else {
      resolver.update(existing, pending, null, null)
      existing
    } ?: return false
    resolver.openOutputStream(uri, "wt")?.use { stream ->
      stream.write(json.toByteArray(Charsets.UTF_8))
    } ?: return false
    val done = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
    resolver.update(uri, done, null, null)
    true
  } catch (_: Exception) {
    false
  }
}

private fun writeLegacyDownload(json: String): Boolean {
  return try {
    val dir = File(
      Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
      "SolarCalculator",
    )
    if (!dir.exists() && !dir.mkdirs()) return false
    File(dir, BACKUP_FILE_NAME).writeText(json)
    true
  } catch (_: Exception) {
    false
  }
}

private fun readPublic(context: Context): String? {
  readLegacyDownload()?.let { return it }
  if (Build.VERSION.SDK_INT < 29) return null
  return try {
    val resolver = context.contentResolver
    val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
    val selection = "${MediaStore.MediaColumns.DISPLAY_NAME}=? AND ${MediaStore.MediaColumns.RELATIVE_PATH}=?"
    val args = arrayOf(BACKUP_FILE_NAME, RELATIVE_PATH)
    val uri = resolver.query(
      collection,
      arrayOf(MediaStore.MediaColumns._ID),
      selection,
      args,
      null,
    )?.use { cursor ->
      if (!cursor.moveToFirst()) null
      else ContentUris.withAppendedId(collection, cursor.getLong(0))
    } ?: return null
    resolver.openInputStream(uri)?.use { stream ->
      stream.readBytes().toString(Charsets.UTF_8)
    }
  } catch (_: Exception) {
    null
  }
}

private fun readLegacyDownload(): String? {
  return try {
    val file = File(
      Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
      "SolarCalculator/$BACKUP_FILE_NAME",
    )
    if (!file.exists() || !file.canRead()) null else file.readText()
  } catch (_: Exception) {
    null
  }
}
