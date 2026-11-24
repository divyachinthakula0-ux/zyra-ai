
from pathlib import Path
import shutil

# ZYRA can manage files only inside this folder.
BASE_FOLDER = (Path.home() / "Documents" / "ZYRA_Files").resolve()
BASE_FOLDER.mkdir(parents=True, exist_ok=True)


def safe_path(relative_path):
    """Allow access only inside the ZYRA_Files folder."""

    if not isinstance(relative_path, str) or not relative_path.strip():
        raise ValueError("Please provide a file or folder name.")

    candidate = Path(relative_path)

    if candidate.is_absolute():
        raise ValueError("Absolute paths are not allowed.")

    if ".." in candidate.parts:
        raise ValueError("Parent-folder navigation is not allowed.")

    path = (BASE_FOLDER / candidate).resolve()

    if path == BASE_FOLDER or BASE_FOLDER not in path.parents:
        raise ValueError("Access outside the ZYRA_Files folder is not allowed.")

    return path


def create_file(file_path, content=""):
    path = safe_path(file_path)

    if path.exists():
        raise FileExistsError("That file already exists.")

    if path.suffix.lower() not in {".txt", ".md", ".csv", ".json"}:
        raise ValueError("Only TXT, MD, CSV and JSON files can be created.")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

    return str(path)


def create_folder(folder_path):
    path = safe_path(folder_path)

    if path.exists():
        raise FileExistsError("That folder already exists.")

    path.mkdir(parents=True)

    return str(path)


def search_files(name):
    if not name or not name.strip():
        raise ValueError("Please provide a search name.")

    matches = []

    for item in BASE_FOLDER.rglob("*"):
        if item.is_symlink():
            continue

        if item.is_file() and name.lower() in item.name.lower():
            matches.append(str(item.relative_to(BASE_FOLDER)))

        if len(matches) >= 100:
            break

    return matches


def read_file(file_path):
    path = safe_path(file_path)

    if not path.is_file():
        raise FileNotFoundError("File not found.")

    if path.suffix.lower() not in {
        ".txt", ".md", ".csv", ".json", ".py", ".html", ".css", ".js"
    }:
        raise ValueError("This file type cannot be read by ZYRA.")

    if path.stat().st_size > 200_000:
        raise ValueError("File is too large to read (maximum 200 KB).")

    return path.read_text(encoding="utf-8")


def rename_file(file_path, new_name):
    source = safe_path(file_path)

    if not source.is_file():
        raise FileNotFoundError("File not found.")

    if not new_name or Path(new_name).name != new_name:
        raise ValueError("Please provide a valid new file name.")

    destination = safe_path(
        str(source.relative_to(BASE_FOLDER).parent / new_name)
    )

    if destination.exists():
        raise FileExistsError("A file with that name already exists.")

    source.rename(destination)

    return str(destination)


def copy_file(file_path, destination_folder=""):
    source = safe_path(file_path)
    destination_dir = safe_path(destination_folder) if destination_folder else BASE_FOLDER

    if not source.is_file():
        raise FileNotFoundError("Source file not found.")

    if not destination_dir.is_dir():
        raise FileNotFoundError("Destination folder not found.")

    destination = destination_dir / source.name

    if destination.exists():
        raise FileExistsError("A file with that name already exists in the destination.")

    shutil.copy2(source, destination)

    return str(destination)


def move_file(file_path, destination_folder=""):
    source = safe_path(file_path)
    destination_dir = safe_path(destination_folder) if destination_folder else BASE_FOLDER

    if not source.is_file():
        raise FileNotFoundError("Source file not found.")

    if not destination_dir.is_dir():
        raise FileNotFoundError("Destination folder not found.")

    destination = destination_dir / source.name

    if destination.exists():
        raise FileExistsError("A file with that name already exists in the destination.")

    shutil.move(str(source), str(destination))

    return str(destination)


def delete_file(file_path):
    """Delete a file only. Directories are never deleted."""

    path = safe_path(file_path)

    if not path.exists():
        raise FileNotFoundError("File not found.")

    if not path.is_file():
        raise ValueError("ZYRA can delete files only, not folders.")

    path.unlink()

    return "File deleted successfully."
